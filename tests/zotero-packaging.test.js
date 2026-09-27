const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const distZotero = path.join(root, 'dist-zotero');
const distZip = path.join(root, 'dist-zip');

// 1. Verify dist-zotero structure
assert(fs.existsSync(distZotero), 'dist-zotero directory must exist');
const manifestPath = path.join(distZotero, 'manifest.json');
assert(fs.existsSync(manifestPath), 'dist-zotero/manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.applications?.zotero?.id, 'researchflow@groele.org');
assert.equal(manifest.version, '9.0.0');

// 2. Verify bootstrap.js and chrome.manifest
const bootstrapPath = path.join(distZotero, 'bootstrap.js');
assert(fs.existsSync(bootstrapPath), 'bootstrap.js must exist');
const bootstrapContent = fs.readFileSync(bootstrapPath, 'utf8');
assert(bootstrapContent.includes('async function startup'), 'bootstrap.js must define startup');
assert(bootstrapContent.includes('async function shutdown'), 'bootstrap.js must define shutdown');

const hostScriptPath = path.join(distZotero, 'chrome', 'content', 'scripts', 'index.js');
assert(fs.existsSync(hostScriptPath), 'dist-zotero/chrome/content/scripts/index.js must exist');
const hostScript = fs.readFileSync(hostScriptPath, 'utf8');
assert(hostScript.includes('showToast'), 'host script must support ProgressWindow showToast');
assert(hostScript.includes('initNotifier'), 'host script must support Zotero.Notifier reactive observer');
assert(hostScript.includes('searchLibrary'), 'host script must support Zotero.Search library search');
assert(hostScript.includes('registerMenus'), 'host script must support Zotero.MenuManager menus');

const chromeManifestPath = path.join(distZotero, 'chrome.manifest');
assert(fs.existsSync(chromeManifestPath), 'chrome.manifest must exist');
const chromeManifest = fs.readFileSync(chromeManifestPath, 'utf8');
assert(chromeManifest.includes('content researchflow chrome/content/'));

// 3. Verify content index.html and preferences
const indexPath = path.join(distZotero, 'chrome', 'content', 'index.html');
assert(fs.existsSync(indexPath), 'chrome/content/index.html must exist');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
assert(indexHtml.includes('scripts/zotero-bridge.js'), 'index.html must include zotero-bridge.js');

const prefXhtml = path.join(distZotero, 'chrome', 'content', 'preferences.xhtml');
assert(fs.existsSync(prefXhtml), 'chrome/content/preferences.xhtml must exist');

// 4. Verify XPI archive
const xpiPath = path.join(distZip, 'researchflow-zotero-9.0.0.xpi');
assert(fs.existsSync(xpiPath), 'researchflow-zotero-9.0.0.xpi must exist in dist-zip');
const xpiStats = fs.statSync(xpiPath);
assert(xpiStats.size > 50000, 'XPI file must be at least 50KB');

console.log('zotero packaging tests passed');
