/**
 * eReport Engine dispatcher
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 4 (New Report Engine)
 *
 * TrendSCORE is single-tenant-per-deployment (confirmed ER-009 / Phase 1
 * Decision D1: `provisionNewSchool()` hard-fails if a second School row is
 * ever created, and `SchoolSettings.jsx` documents "Single-tenant: PUT
 * /schools updates the one school record"). `resolveCurrentSchool()` below
 * therefore reads the one active School row rather than taking a schoolId
 * parameter — there is no other school it could mean.
 *
 * LEGACY branch is a deliberate pass-through to the existing,
 * already-working report.service.ts path. Per brief §13 ("do not rewrite
 * working systems simply because they are old") and §36 ("understand first,
 * refactor second, replace third, delete last"), this file adds a dispatch
 * layer in front of report.service.ts — it does not modify report.service.ts
 * itself, and today's legacy behavior is unchanged for every school still on
 * reportEngine = LEGACY (which is every existing school, per its default).
 */

import { ReportEngine, Term } from '@prisma/client';
import prisma from '../config/database';
import * as reportService from './report.service';
import type { TermlyReportData } from './report.service';
import { resolveCurrentSchool } from './school-resolver.service';

export interface EngineReportResult {
  engine: ReportEngine;
  data: TermlyReportData;
  templateId: string | null;
  templateKey: string | null;
  templateVersion: number | null;
}

/**
 * Generates a termly report through whichever engine this installation is
 * currently configured for (School.reportEngine). The underlying academic
 * data (report.service.ts) is identical in both branches — only what
 * happens with the result differs:
 *
 *   LEGACY: return the data as-is. Byte-for-byte the same call
 *           report.service.ts already made before this file existed.
 *
 *   NEW:    also resolve the school's selected Template and upsert a
 *           ReportSnapshot (Phase 2 §2.2/§2.4, Decision D3) — a lightweight
 *           record of exactly which template + version rendered this
 *           specific report, so it can be reproduced exactly later even if
 *           the template is subsequently changed or a newer version ships.
 *           This does NOT duplicate academic data (brief §5/§24) — it
 *           stores the already-computed ReportData, not a second copy of
 *           the source assessment/attendance/etc. tables.
 *
 *           IMPORTANT: this endpoint is called on every report *view*, not
 *           just when a report is explicitly "issued" — there is no
 *           separate issue/publish action today. The snapshot is therefore
 *           upserted (one row per learner+term+year, refreshed on each
 *           view) rather than inserted, so repeated viewing does not grow
 *           report_snapshots unboundedly. Consequence: `generatedBy`
 *           reflects whoever most recently *viewed* the report, not
 *           necessarily whoever first generated/issued it — a genuine
 *           "issued by" audit trail would need a distinct issue action,
 *           which does not exist yet.
 *
 * If the school is on NEW but hasn't selected a template yet (a
 * configuration gap, not a data error), the report data is still returned
 * so the caller has *something* to show — it just isn't snapshotted against
 * a template that doesn't exist yet.
 */
export async function generateReport(
  learnerId: string,
  term: Term,
  academicYear: number,
  generatedBy: string
): Promise<EngineReportResult> {
  const school = await resolveCurrentSchool();
  const engine: ReportEngine = school?.reportEngine ?? 'LEGACY';

  const data = await reportService.generateTermlyReport(learnerId, term, academicYear);

  if (engine !== 'NEW') {
    return { engine, data, templateId: null, templateKey: null, templateVersion: null };
  }

  const templateId = school?.reportTemplateId ?? null;
  if (!templateId) {
    return { engine, data, templateId: null, templateKey: null, templateVersion: null };
  }

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { id: true, key: true, version: true },
  });

  if (!template) {
    // Selected template was deleted/deactivated out from under the school's
    // setting. Don't crash report generation over a dangling reference —
    // surface the data and let the admin re-select a template.
    return { engine, data, templateId: null, templateKey: null, templateVersion: null };
  }

  await prisma.reportSnapshot.upsert({
    where: {
      learnerId_term_academicYear: { learnerId, term, academicYear },
    },
    create: {
      learnerId,
      term,
      academicYear,
      templateId: template.id,
      templateVersion: template.version,
      // Phase 9 (Historical Report Rendering) confirmed generateReport()
      // should keep NOT reading this back: every call recomputes `data`
      // live from report.service.ts, deliberately, even for past terms.
      // Requester's explicit decision: a historical report that's viewed
      // again after its source data was corrected re-renders silently with
      // the corrected values — no "re-rendered on <date>" provenance
      // marker, no snapshot-vs-live distinction surfaced anywhere. This
      // ReportSnapshot row therefore stays what Decision D3 always meant it
      // to be: a record of which template+version rendered a report, for
      // reproducing that presentation later — never a source of truth read
      // back into a response. Do not add snapshot read-back without a new,
      // explicit decision reopening this one.
      //
      // (Still true, unrelated to the above: Prisma serializes Date fields
      // in `data` to ISO strings in this Json column — irrelevant today
      // only because nothing reads it back, per the decision above.)
      reportData: data as any,
      generatedBy,
    },
    update: {
      templateId: template.id,
      templateVersion: template.version,
      reportData: data as any,
      generatedBy,
      generatedAt: new Date(),
    },
  });

  return { engine, data, templateId: template.id, templateKey: template.key, templateVersion: template.version };
}

/**
 * Which engine this installation is currently on. Exposed separately from
 * generateReport() for callers (e.g. a future template-preview endpoint)
 * that need to know the engine without generating a full report.
 */
export async function resolveEngine(): Promise<ReportEngine> {
  const school = await resolveCurrentSchool();
  return school?.reportEngine ?? 'LEGACY';
}
