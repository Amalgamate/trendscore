/**
 * Report Template data-access layer.
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 5 (Template Data Model / Configuration)
 *
 * Thin wrapper around the `Template` model (added in Phase 2/3, modeled on the
 * existing App/SchoolAppConfig convention — see checklist §2.2). This file is
 * the single place that reads/writes `Template` rows so that:
 *   - the future School Settings "Report Templates" tab (Phase 7) has a
 *     stable service to call rather than querying prisma.template directly
 *     from a controller, and
 *   - `reportEngine.service.ts` (Phase 4) and this file agree on exactly what
 *     a template "is" — see `TemplateSummary` below, which mirrors the shape
 *     `reportEngine.service.ts` already selects inline.
 *
 * Per Decision D2 (checklist Phase 1): a Template row does not carry layout —
 * it is a pointer (`key`) to a hand-built React component registered in the
 * frontend's `reportTemplates/registry.js` (Phase 5, same session). This
 * service only ever deals with the pointer + metadata, never markup.
 */

import prisma from '../config/database';

/**
 * The template a school falls back to when none has been explicitly chosen.
 * Mirrors `DEFAULT_REPORT_TEMPLATE_KEY` in the frontend's
 * `reportTemplates/registry.js` — both must name the same key, since the
 * frontend resolves the component and the backend resolves the DB row.
 */
export const DEFAULT_REPORT_TEMPLATE_KEY = 'classic';

export interface TemplateSummary {
  id: string;
  key: string;
  name: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Templates a school can currently choose (Phase 7 admin picker). Retired
 * templates (isActive = false) are deliberately excluded here but must stay
 * queryable by id — see getTemplateById — because historical ReportSnapshots
 * (Decision D3) may still reference them and need to resolve the component
 * that rendered them, even after the template is retired from new selection.
 */
export async function listActiveTemplates(): Promise<TemplateSummary[]> {
  return prisma.template.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, key: true, name: true, version: true, isActive: true, createdAt: true },
  });
}

export async function getTemplateById(id: string): Promise<TemplateSummary | null> {
  return prisma.template.findUnique({
    where: { id },
    select: { id: true, key: true, name: true, version: true, isActive: true, createdAt: true },
  });
}

export async function getTemplateByKey(key: string): Promise<TemplateSummary | null> {
  return prisma.template.findUnique({
    where: { key },
    select: { id: true, key: true, name: true, version: true, isActive: true, createdAt: true },
  });
}

/**
 * Idempotent upsert used by the Phase 6 seed step (and any future template
 * addition) — keyed on `key`, never on `id`, so re-running a seed script
 * doesn't create duplicate rows. Bumping `version` here is a deliberate,
 * explicit act (Decision D3 relies on `version` changing meaning something)
 * — this function will NOT silently bump version on every call; pass the
 * version you intend.
 */
export async function upsertTemplate(input: {
  key: string;
  name: string;
  version?: number;
  isActive?: boolean;
}): Promise<TemplateSummary> {
  return prisma.template.upsert({
    where: { key: input.key },
    update: {
      name: input.name,
      ...(input.version !== undefined ? { version: input.version } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    create: {
      key: input.key,
      name: input.name,
      version: input.version ?? 1,
      isActive: input.isActive ?? true,
    },
    select: { id: true, key: true, name: true, version: true, isActive: true, createdAt: true },
  });
}
