/**
 * ResearchFlow for Zotero - Packaging Pipeline
 * Stages Zotero addon structure, integrates web app assets,
 * validates syntax, and packages into .xpi for Zotero 7+ & 10
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const zoteroSrc = path.join(projectRoot, 'zotero');
const zoteroStaging = path.join(projectRoot, 'dist-zotero');
const contentDir = path.join(zoteroStaging, 'chrome', 'content');

function copyDirRecursive(src, dest, filterFn) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (filterFn && !filterFn(entry.name, entry.isDirectory())) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(zoteroSrc, 'manifest.json'), 'utf-8'));
  const addonVersion = manifest.version;

  console.log('🧹 [1/4] Preparing ResearchFlow Zotero staging directory (dist-zotero)...');
  if (fs.existsSync(zoteroStaging)) {
    fs.rmSync(zoteroStaging, { recursive: true, force: true });
  }
  fs.mkdirSync(zoteroStaging, { recursive: true });

  // 1. Copy core Zotero root files
  fs.copyFileSync(path.join(zoteroSrc, 'manifest.json'), path.join(zoteroStaging, 'manifest.json'));
  fs.copyFileSync(path.join(zoteroSrc, 'update.json'), path.join(zoteroStaging, 'update.json'));
  fs.copyFileSync(path.join(zoteroSrc, 'bootstrap.js'), path.join(zoteroStaging, 'bootstrap.js'));
  fs.copyFileSync(path.join(zoteroSrc, 'prefs.js'), path.join(zoteroStaging, 'prefs.js'));
  fs.copyFileSync(path.join(zoteroSrc, 'chrome.manifest'), path.join(zoteroStaging, 'chrome.manifest'));

  // 2. Copy locales & chrome files from zotero/
  copyDirRecursive(path.join(zoteroSrc, 'locale'), path.join(zoteroStaging, 'locale'));
  copyDirRecursive(path.join(zoteroSrc, 'chrome'), path.join(zoteroStaging, 'chrome'));

  console.log('📂 [2/4] Integrating web app assets (styles, scripts, assets, data, pages)...');
  copyDirRecursive(path.join(projectRoot, 'styles'), path.join(contentDir, 'styles'));
  copyDirRecursive(path.join(projectRoot, 'scripts'), path.join(contentDir, 'scripts'), (name) => !name.startsWith('build-zotero'));
  copyDirRecursive(path.join(projectRoot, 'assets'), path.join(contentDir, 'assets'));
  copyDirRecursive(path.join(projectRoot, 'data'), path.join(contentDir, 'data'));
  copyDirRecursive(path.join(projectRoot, 'pages'), path.join(contentDir, 'pages'));

  // Generate compatible index.html for Zotero chrome:// context
  const optionsHtmlPath = path.join(projectRoot, 'pages', 'options.html');
  let rawHtml = fs.readFileSync(optionsHtmlPath, 'utf-8');

  // Convert relative '../' references to root-level references for chrome://researchflow/content/index.html
  let indexHtml = rawHtml
    .replace(/\.\.\/styles\//g, 'styles/')
    .replace(/\.\.\/scripts\//g, 'scripts/')
    .replace(/\.\.\/assets\//g, 'assets/')
    .replace(/\.\.\/data\//g, 'data/');

  // Ensure zotero-bridge.js is included before storage.js
  if (!indexHtml.includes('scripts/zotero-bridge.js')) {
    indexHtml = indexHtml.replace(
      '<script src="scripts/storage.js"></script>',
      '<script src="scripts/zotero-bridge.js"></script>\n  <script src="scripts/storage.js"></script>'
    );
  }

  // Inject Gecko runtime polyfills & Zotero argument binding
  const zoteroPolyfill = `
  <script>
    // Zotero / Gecko Runtime Bridge Polyfills
    window.process = window.process || { env: { NODE_ENV: 'production' } };
    window.global = window.global || window;
    try {
      if (window.arguments && window.arguments[0]) {
        if (window.arguments[0].Zotero) {
          window.Zotero = window.arguments[0].Zotero;
        }
        if (window.arguments[0].options) {
          window._researchflowPending = window.arguments[0].options;
        }
      }
    } catch (_) {}
  </script>
  `;
  indexHtml = indexHtml.replace('<head>', '<head>' + zoteroPolyfill);

  fs.writeFileSync(path.join(contentDir, 'index.html'), indexHtml, 'utf-8');
  fs.writeFileSync(path.join(projectRoot, 'index.html'), indexHtml, 'utf-8');

  console.log('🔍 [3/4] Validating JavaScript syntax...');
  execSync(`node --check "${path.join(zoteroStaging, 'bootstrap.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(zoteroStaging, 'chrome', 'content', 'scripts', 'index.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(zoteroStaging, 'chrome', 'content', 'scripts', 'preferences.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(contentDir, 'scripts', 'zotero-bridge.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(contentDir, 'scripts', 'storage.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(contentDir, 'scripts', 'ui-utils.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(contentDir, 'scripts', 'core', 'research-core.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(contentDir, 'scripts', 'share-card.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(contentDir, 'scripts', 'options.js')}"`, { stdio: 'inherit' });

  console.log('📦 [4/4] Packaging into Zotero .xpi archive...');
  const psScriptPath = path.join(projectRoot, 'scripts', 'build-zotero.ps1');
  execSync(`pwsh -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });

  console.log(`\n✨ Build completed successfully!`);
  console.log(`📦 Zotero Addon XPI ready at: dist-zip/researchflow-zotero-${addonVersion}.xpi`);
  console.log(`📂 Unpacked staging ready at: dist-zotero/`);
}

main().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
