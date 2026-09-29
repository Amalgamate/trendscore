'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// Mirrors users-store.js / billing-store.js's shape: node:sqlite
// DatabaseSync, one file in CONSOLE_DATA_DIR, camelCase projections out of
// the DB, plain functions (no class) exported from a factory.
//
// TRENDSCORE_ERP_ADMIN_PLAN.md Phase 2 — before this store existed, "a
// tenant" had no persistent record anywhere: the Instances section is
// entirely live Docker introspection (server.js's collectRuntime()), and
// instances.manifest.json is a deploy-target list, not a tenant registry.
// This store is the system of record for "a tenant/school exists and is
// active/suspended/decommissioned" — independent of whatever Docker
// happens to report at request time. Covers every APP_TYPE_METADATA type
// (school, sacco, hospital, hotel, organization, odoo, wordpress), not
// just school, per the phase's explicit instruction not to hardcode school
// anywhere in this store.

const APP_TYPES = ['school', 'sacco', 'hospital', 'hotel', 'organization', 'odoo', 'wordpress', 'platform', 'other'];
const STATUSES = ['active', 'suspended', 'decommissioned'];
const SOURCES = ['manual', 'backfill_manifest', 'backfill_runtime', 'provisioning'];

function createTenantsStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'platform-tenants.sqlite'));
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      app_type TEXT NOT NULL CHECK (app_type IN (${APP_TYPES.map(t => `'${t}'`).join(', ')})),
      domain TEXT NOT NULL DEFAULT '',
      tenant_key TEXT NOT NULL DEFAULT '',
      compose_project TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN (${STATUSES.map(s => `'${s}'`).join(', ')})) DEFAULT 'active',
      status_reason TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL CHECK (source IN (${SOURCES.map(s => `'${s}'`).join(', ')})) DEFAULT 'manual',
      provision_job_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      decommissioned_at TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON tenants(slug);
    CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants(status);
    CREATE INDEX IF NOT EXISTS tenants_app_type_idx ON tenants(app_type);
  `);

  const nowIso = () => new Date().toISOString();

  const tenantColumns = `id, slug, name, app_type AS appType, domain, tenant_key AS tenantKey,
    compose_project AS composeProject, status, status_reason AS statusReason,
    contact_email AS contactEmail, contact_phone AS contactPhone, notes,
    source, provision_job_id AS provisionJobId,
    created_at AS createdAt, updated_at AS updatedAt, decommissioned_at AS decommissionedAt`;

  function listTenants({ status } = {}) {
    if (status) {
      return db.prepare(`SELECT ${tenantColumns} FROM tenants WHERE status = ? ORDER BY created_at ASC`).all(status);
    }
    return db.prepare(`SELECT ${tenantColumns} FROM tenants ORDER BY created_at ASC`).all();
  }

  function getTenant(id) {
    return db.prepare(`SELECT ${tenantColumns} FROM tenants WHERE id = ?`).get(String(id));
  }

  function getTenantBySlug(slug) {
    return db.prepare(`SELECT ${tenantColumns} FROM tenants WHERE slug = ?`).get(String(slug || '').trim().toLowerCase());
  }

  function getTenantByTenantKey(tenantKey) {
    const normalized = String(tenantKey || '').trim().toLowerCase();
    if (!normalized) return null;
    return db.prepare(`SELECT ${tenantColumns} FROM tenants WHERE lower(tenant_key) = ?`).get(normalized);
  }

  function createTenant({
    slug, name, appType, domain = '', tenantKey = '', composeProject = '',
    contactEmail = '', contactPhone = '', notes = '',
    source = 'manual', provisionJobId = '', status = 'active',
  }) {
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    if (!normalizedSlug) throw new Error('slug is required');
    if (!String(name || '').trim()) throw new Error('name is required');
    if (!APP_TYPES.includes(appType)) throw new Error(`appType must be one of: ${APP_TYPES.join(', ')}`);
    if (!STATUSES.includes(status)) throw new Error(`status must be one of: ${STATUSES.join(', ')}`);
    if (!SOURCES.includes(source)) throw new Error(`source must be one of: ${SOURCES.join(', ')}`);
    if (getTenantBySlug(normalizedSlug)) throw new Error(`A tenant with slug "${normalizedSlug}" already exists`);

    const id = crypto.randomUUID();
    const timestamp = nowIso();
    db.prepare(`
      INSERT INTO tenants (
        id, slug, name, app_type, domain, tenant_key, compose_project,
        status, contact_email, contact_phone, notes, source, provision_job_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, normalizedSlug, String(name).trim(), appType, String(domain || ''), String(tenantKey || '').trim().toLowerCase(),
      String(composeProject || ''), status, String(contactEmail || '').trim().toLowerCase(), String(contactPhone || ''),
      String(notes || ''), source, String(provisionJobId || ''), timestamp, timestamp,
    );
    return getTenant(id);
  }

  function updateTenant(id, patch = {}) {
    const existing = getTenant(id);
    if (!existing) throw new Error('Tenant not found');

    const next = {
      name: patch.name !== undefined ? String(patch.name).trim() : existing.name,
      appType: patch.appType !== undefined ? patch.appType : existing.appType,
      domain: patch.domain !== undefined ? String(patch.domain) : existing.domain,
      tenantKey: patch.tenantKey !== undefined ? String(patch.tenantKey).trim().toLowerCase() : existing.tenantKey,
      composeProject: patch.composeProject !== undefined ? String(patch.composeProject) : existing.composeProject,
      contactEmail: patch.contactEmail !== undefined ? String(patch.contactEmail).trim().toLowerCase() : existing.contactEmail,
      contactPhone: patch.contactPhone !== undefined ? String(patch.contactPhone) : existing.contactPhone,
      notes: patch.notes !== undefined ? String(patch.notes) : existing.notes,
    };
    if (!next.name) throw new Error('name is required');
    if (!APP_TYPES.includes(next.appType)) throw new Error(`appType must be one of: ${APP_TYPES.join(', ')}`);

    db.prepare(`
      UPDATE tenants SET name = ?, app_type = ?, domain = ?, tenant_key = ?, compose_project = ?,
        contact_email = ?, contact_phone = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.name, next.appType, next.domain, next.tenantKey, next.composeProject,
      next.contactEmail, next.contactPhone, next.notes, nowIso(), String(id),
    );
    return getTenant(id);
  }

  // Suspending/reactivating/decommissioning are business-status changes
  // only — they deliberately do NOT touch the running Docker containers.
  // Stopping/starting the actual runtime stays a separate, explicit action
  // (server.js's existing /api/instances/:key/:action) so one action never
  // silently triggers the other.
  function suspendTenant(id, reason) {
    const existing = getTenant(id);
    if (!existing) throw new Error('Tenant not found');
    if (existing.status === 'decommissioned') throw new Error('Cannot suspend a decommissioned tenant');
    if (!String(reason || '').trim()) throw new Error('A reason is required to suspend a tenant');
    db.prepare(`UPDATE tenants SET status = 'suspended', status_reason = ?, updated_at = ? WHERE id = ?`)
      .run(String(reason).trim(), nowIso(), String(id));
    return getTenant(id);
  }

  function reactivateTenant(id) {
    const existing = getTenant(id);
    if (!existing) throw new Error('Tenant not found');
    if (existing.status === 'decommissioned') throw new Error('Cannot reactivate a decommissioned tenant');
    db.prepare(`UPDATE tenants SET status = 'active', status_reason = '', updated_at = ? WHERE id = ?`)
      .run(nowIso(), String(id));
    return getTenant(id);
  }

  function decommissionTenant(id, reason) {
    const existing = getTenant(id);
    if (!existing) throw new Error('Tenant not found');
    if (existing.status === 'decommissioned') throw new Error('Tenant is already decommissioned');
    if (!String(reason || '').trim()) throw new Error('A reason is required to decommission a tenant');
    const timestamp = nowIso();
    db.prepare(`
      UPDATE tenants SET status = 'decommissioned', status_reason = ?, decommissioned_at = ?, updated_at = ?
      WHERE id = ?
    `).run(String(reason).trim(), timestamp, timestamp, String(id));
    return getTenant(id);
  }

  function countByStatus(status) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM tenants WHERE status = ?`).get(status);
    return Number(row?.n || 0);
  }

  return {
    APP_TYPES,
    STATUSES,
    SOURCES,
    listTenants,
    getTenant,
    getTenantBySlug,
    getTenantByTenantKey,
    createTenant,
    updateTenant,
    suspendTenant,
    reactivateTenant,
    decommissionTenant,
    countByStatus,
    close: () => db.close(),
  };
}

module.exports = { createTenantsStore };
