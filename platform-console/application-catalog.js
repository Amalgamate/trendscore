'use strict';

const modulePackageCatalog = require('../server/src/data/module-package-catalog.json');

const PUBLIC_APPLICATION_PACKAGES = ['starter', 'standard', 'professional'];

function publicPackageOptions(schoolType) {
  const normalizedType = String(schoolType || '').trim().toUpperCase();
  if (!normalizedType.endsWith('PRIMARY')) return [];
  const active = new Set();
  return PUBLIC_APPLICATION_PACKAGES.map(id => {
    const pack = modulePackageCatalog.packages[id];
    pack.active.forEach(slug => active.add(slug));
    if (id === 'starter' && normalizedType === 'PRIVATE_PRIMARY') active.add('fee-management');
    const modules = new Set(active);
    if (id === 'starter' && normalizedType !== 'PRIVATE_PRIMARY') modules.delete('fee-management');
    return {
      id,
      name: pack.name,
      description: pack.description,
      modules: modulePackageCatalog.modules
        .filter(module => modules.has(module.slug))
        .map(module => ({ slug: module.slug, name: module.name })),
    };
  });
}

module.exports = { PUBLIC_APPLICATION_PACKAGES, publicPackageOptions };
