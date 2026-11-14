'use strict';

const fs = require('fs');
const path = require('path');

const packagedCatalogPath = path.join(__dirname, 'data', 'module-package-catalog.json');
const repositoryCatalogPath = path.join(__dirname, '..', 'server', 'src', 'data', 'module-package-catalog.json');
const catalogPath = fs.existsSync(packagedCatalogPath) ? packagedCatalogPath : repositoryCatalogPath;

module.exports = require(catalogPath);
