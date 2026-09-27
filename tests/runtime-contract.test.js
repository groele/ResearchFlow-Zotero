const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const manifest = JSON.parse(read('manifest.json'));

[
  manifest.background.service_worker,
  manifest.options_page
].forEach((entrypoint) => {
  assert(exists(entrypoint), `manifest entrypoint should exist: ${entrypoint}`);
});

assert(Array.isArray(manifest.content_scripts), 'submission portal content scripts should be registered');
const portalContentScript = manifest.content_scripts.find(entry =>
  entry.js?.includes('scripts/journal-portals.js') && entry.js?.includes('scripts/content.js')
);
assert(portalContentScript, 'portal detection should load before the page prompt controller');
assert(
  portalContentScript.matches.some(pattern => pattern.includes('manuscriptcentral.com')),
  'ScholarOne portals should be supported'
);
assert(
  portalContentScript.matches.some(pattern => pattern.includes('editorialmanager.com')),
  'Editorial Manager portals should be supported'
);

for (const pagePath of [manifest.options_page]) {
  const html = read(pagePath);
  for (const match of html.matchAll(/<script\s+src="([^"]+)"/g)) {
    const scriptPath = path.normalize(path.join(path.dirname(pagePath), match[1]));
    assert(exists(scriptPath), `${pagePath} should load an existing script: ${scriptPath}`);
  }
}

const requiredIds = {
  'pages/options.html': [
    'view-dashboard', 'view-manuscripts', 'view-submissions', 'view-settings',
    'dashboard-gantt', 'cards-idea', 'cards-drafting', 'cards-submitted',
    'cards-accepted', 'submissions-list-container', 'submission-detail-panel',
    'journal-portals-list', 'route-db', 'btn-export-db', 'btn-export-diagnostics', 'btn-manual-sync',
    'modal-container'
  ]
};

for (const [pagePath, ids] of Object.entries(requiredIds)) {
  const html = read(pagePath);
  for (const id of ids) {
    assert(html.includes(`id="${id}"`), `${pagePath} should provide #${id}`);
  }
}

assert(!exists('scripts/modules/projects.js'), 'removed projects dashboard module should stay absent');
assert(!exists('scripts/modules/library.js'), 'removed library dashboard module should stay absent');
assert(!exists('scripts/modules/dashboard.js'), 'unused duplicate dashboard module should stay absent');
assert(!exists('scripts/modules/settings.js'), 'unused duplicate settings module should stay absent');
assert(!exists('scripts/ai.js'), 'retired AI runtime should stay absent');
assert(!exists('pages/sidepanel.html'), 'side panel page should be removed');
assert(!exists('scripts/sidepanel.js'), 'side panel controller should be removed');
assert(!exists('styles/sidepanel.css'), 'side panel styles should be removed');
assert(!exists('pages/popup.html'), 'toolbar popup page should be removed');
assert(!exists('scripts/popup.js'), 'toolbar popup controller should be removed');
assert(!('default_popup' in manifest.action), 'toolbar icon should bypass the popup');
assert(!('side_panel' in manifest), 'manifest should not register a side panel');
assert(!manifest.permissions.includes('sidePanel'), 'manifest should not request sidePanel permission');
assert(manifest.permissions.includes('activeTab'), 'Scholar mirror capture should use temporary active-tab access');
assert(manifest.permissions.includes('scripting'), 'Scholar mirror capture should inject its detector only after a toolbar click');
assert(!manifest.permissions.includes('contextMenus'), 'focused runtime should not request the retired contextMenus permission');
assert(
  !manifest.host_permissions.some(origin => origin.includes('api.unpaywall.org')),
  'focused runtime should not retain the retired Unpaywall host permission'
);

const backgroundJs = read(manifest.background.service_worker);
assert(backgroundJs.includes('chrome.action.onClicked.addListener'), 'toolbar icon should have a click handler');
assert(backgroundJs.includes('chrome.runtime.openOptionsPage()'), 'toolbar icon should open the main workspace');
assert(backgroundJs.includes('captureScholarPageFromTab'), 'toolbar clicks should inspect Scholar-compatible result pages');
assert(backgroundJs.includes("files: ['scripts/scholar-mirrors.js']"), 'Scholar detection should be injected on demand');
assert(backgroundJs.includes('researchflow_pending_academic_draft'), 'captured Scholar metadata should use a short-lived review draft');
assert(backgroundJs.includes("'academic-capture'"), 'Scholar capture should open the manuscript review route');
assert(exists('scripts/scholar-mirrors.js'), 'Scholar mirror detector should ship with the extension');
assert(!backgroundJs.includes('openPanelOnActionClick'), 'toolbar icon should not open the side panel');
assert(backgroundJs.includes('OPEN_SUBMISSION_CAPTURE'), 'background should accept detected submission drafts');
assert(backgroundJs.includes('researchflow_pending_submission_draft'), 'background should persist a short-lived submission draft');
assert(backgroundJs.includes('openSubmissionCapturePage'), 'detected portals should open the direct submission form route');
assert(backgroundJs.includes("openWorkspacePage('submission-capture')"), 'detected portals should request submission capture mode');
assert(backgroundJs.includes('chrome.tabs.update'), 'an existing workspace should navigate directly to the submission form');
assert(backgroundJs.includes('chrome.tabs.create'), 'a missing workspace should open the submission form in a new tab');
assert(backgroundJs.includes('SAVE_DATABASE'), 'background should serialize database writes across extension pages');
assert(backgroundJs.includes('databaseWriteQueue'), 'background database writes should use a single queue');
assert(!backgroundJs.includes('chrome.contextMenus'), 'background should not retain the removed research-record context menu');
assert(!backgroundJs.includes('FETCH_PDF_VIA_UNPAYWALL'), 'background should not retain the removed article lookup route');
assert(!backgroundJs.includes('CACHE_SCRAPE_RESULT'), 'background should not retain the removed article metadata cache');

const contentJs = read('scripts/content.js');
assert(contentJs.includes('maybeOfferSubmissionCapture'), 'content script should offer quick submission entry');
assert(contentJs.includes('safeExtensionStorageGet'), 'content storage reads should degrade when extension context is invalidated');
assert(contentJs.includes('safeExtensionSendMessage'), 'content message sends should degrade when extension context is invalidated');
assert(contentJs.includes('Do not show on this site'), 'portal prompt should support per-site dismissal');
assert(contentJs.includes('collectSubmissionPageSignals'), 'portal capture should collect reviewable workflow fields');
assert(contentJs.includes('Capture information'), 'portal prompt should expose one-click information capture');
assert(contentJs.includes('captureDetailsEnabled'), 'content capture should respect the independent detail-capture switch');
assert(contentJs.includes('width: min(344px, calc(100vw - 28px))'), 'portal capture prompt should remain a compact partial-screen card');
assert(!contentJs.includes('requestIdleCallback(run'), 'portal pages should not start the retired article metadata scan');
['SCRAPE_PAGE', 'PUSH_TO_CACHE', 'CACHE_SCRAPE_RESULT'].forEach(action => {
  assert(!contentJs.includes(action), `content runtime should not expose the retired ${action} route`);
});

const optionsJs = read('scripts/options.js');
assert(optionsJs.includes('consumePendingSubmissionDraft'), 'main workspace should consume detected submission drafts');
assert(optionsJs.includes('consumePendingAcademicDraft'), 'main workspace should consume Scholar capture drafts');
assert(optionsJs.includes('openManuscriptModal(man = null, prefill = null)'), 'manuscript form should accept captured metadata for review');
assert(optionsJs.includes('man-authors'), 'Scholar review should expose captured authors');
assert(optionsJs.includes('man-doi'), 'Scholar review should expose a captured DOI');
assert(optionsJs.includes('man-article-url'), 'Scholar review should expose the source article URL');
assert(optionsJs.includes('academicCaptureProvenance'), 'confirmed Scholar captures should retain local provenance');
assert(optionsJs.includes("classList.add('submission-capture-mode')"), 'detected drafts should enter focused submission form mode');
assert(optionsJs.includes('selectedSubmissionId = newSub.id'), 'new submissions should open as the selected record');
assert(optionsJs.includes('window.RFCore.upsertProject'), 'confirmed capture should create a linked project');

const storageJs = read('scripts/storage.js');
assert(!storageJs.includes('evidence: []'), 'storage defaults should not retain Evidence Locker data');
assert(storageJs.includes('delete normalized.evidence'), 'old databases should discard Evidence Locker data');
assert(storageJs.includes('delete normalized.projectEvidenceLinks'), 'old project evidence links should be discarded');
assert(storageJs.includes('delete normalized.recordEvidenceLinks'), 'old record evidence links should be discarded');
assert(storageJs.includes('delete normalized.settings.ai'), 'old AI settings should be discarded');
assert(storageJs.includes('delete normalized.settings.syncProviders.files'), 'old evidence file routing should be discarded');
assert(storageJs.includes("'manuscripts'"), 'storage should normalize manuscripts');
assert(storageJs.includes("'submissions'"), 'storage should normalize submissions');
assert(storageJs.includes('deletedEntities'), 'storage should retain entity deletion tombstones for remote merges');
assert(storageJs.includes('filterDeletedEntities'), 'remote merge should filter entities deleted on another device');
assert(storageJs.includes('shouldRunCloudSync(this.cache)'), 'local saves should skip incomplete remote sync configurations');
assert(storageJs.includes("action: 'SAVE_DATABASE'"), 'workspace saves should use the serialized background writer');
assert(storageJs.includes('getSyncConfigurationIssue(provider)'), 'manual sync should report invalid provider configuration without attempting a request');
assert(storageJs.includes("return 'Invalid WebDAV URL'"), 'WebDAV URL validation should fail before permission or network access');

console.log('runtime contract tests passed');
