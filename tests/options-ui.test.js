const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const optionsHtml = read('pages/options.html');
const optionsJs = read('scripts/options.js');
const shareRenderer = read('scripts/share-card.js');
const optionsCss = read('styles/options.css') + read('styles/settings.css') + read('styles/workspace.css');
const manifest = JSON.parse(read('manifest.json'));

assert(optionsJs.includes('consumePendingAcademicDraft'), 'main workspace should consume captured Scholar metadata');
assert(optionsJs.includes('openManuscriptModal(man = null, prefill = null)'), 'manuscript review form should support capture prefill');
assert(optionsJs.includes('id="man-authors"'), 'manuscript review should expose authors');
assert(optionsJs.includes('id="man-doi"'), 'manuscript review should expose DOI');
assert(optionsJs.includes('id="man-article-url"'), 'manuscript review should expose the source URL');
assert(optionsJs.includes('academicCaptureProvenance'), 'confirmed Scholar captures should preserve provenance');

['view-dashboard', 'view-manuscripts', 'view-submissions', 'view-settings'].forEach((id) => {
  assert(optionsHtml.includes(`id="${id}"`), `main workspace should include ${id}`);
});
['submission-assist-enabled', 'submission-assist-capture-enabled', 'submission-assist-state-label', 'submission-assist-scope-help', 'btn-reset-submission-assist'].forEach((id) => {
  assert(optionsHtml.includes(`id="${id}"`), `submission recognition settings should include ${id}`);
});
assert(optionsHtml.includes('settings-switch-track'), 'submission recognition should use the shared custom switch treatment');
['settings-workbench', 'settings-primary-column', 'settings-secondary-column', 'settings-route-savebar', 'settings-backup-actions'].forEach((className) => {
  assert(optionsHtml.includes(`class="${className}`) || optionsHtml.includes(` ${className}`), `settings redesign should include ${className}`);
});
assert(!optionsHtml.includes('class="settings-hero-index"'), 'settings should use the shared page header without a decorative index');
['settings-route-privacy-note', 'settings-credential-note', 'settings-backup-note'].forEach((id) => {
  assert(optionsHtml.includes(`id="${id}"`), `settings redesign should expose localized ${id}`);
});
['settings-security-title', 'settings-security-help'].forEach((id) => {
  assert(optionsHtml.includes(`id="${id}"`), `settings should clearly explain local-first security through ${id}`);
});
assert(optionsHtml.includes('class="settings-security-assurance"'), 'settings should lead with a dedicated local-security assurance panel');
['ui-theme', 'auto-cloud-sync', 'settings-auto-sync-control'].forEach((id) => {
  assert(optionsHtml.includes(`id="${id}"`), `settings should expose functional preference ${id}`);
});
assert(/<[^>]*data-sync-provider="local"[^>]*id="settings-local-card"/.test(optionsHtml), 'local-only routing should retain a visible explanatory provider panel');
assert(optionsHtml.includes('class="settings-provider-stage"'), 'provider details should stay grouped inside the storage route card');
assert(!optionsHtml.includes('class="settings-grid"'), 'settings should use the guided workbench instead of a flat card grid');
assert(optionsCss.includes('.settings-workbench'), 'settings workbench should have a dedicated responsive layout');
assert(optionsCss.includes('Settings share the workspace typography'), 'settings should use shared workspace components');
assert(optionsCss.includes('@media (max-width: 1180px)'), 'settings workbench should reflow before the narrow mobile breakpoint');

assert(optionsJs.includes('function applyThemePreference'), 'appearance selection should apply a real workspace theme');
assert(optionsJs.includes('autoSyncToggle.dataset.savedValue'), 'automatic cloud sync should retain its saved state across route changes');
assert(optionsCss.includes('hsl(var(--card-bg))'), 'explicit dark appearance should override the system preference');
assert(optionsJs.includes("mainContent.scrollTop = 0"), 'workspace navigation should reveal the beginning of each settings view');
assert(optionsHtml.includes('v9.0.0 Companion'), 'workspace version label should match the current companion release');
assert.equal(manifest.version, '9.0.0', 'manifest version should match the current companion release');

['view-projects', 'view-library', 'metric-projects', 'metric-records', 'metric-evidence', 'recent-records'].forEach((removedSection) => {
  assert(!optionsHtml.includes(removedSection), `options page should not expose removed ${removedSection}`);
});

['view-evidence', 'ai.js', 'settings-ai-card', 'route-files'].forEach((removedModule) => {
  assert(!optionsHtml.includes(removedModule), `options page should not expose removed ${removedModule}`);
});

['renderDashboard', 'renderKanban', 'renderSubmissions', 'renderJournalPortals', 'loadSettings'].forEach((functionName) => {
  assert(optionsJs.includes(`function ${functionName}`), `main workspace should retain ${functionName}`);
});
['function normalizeText', 'function getSubmissionStatusLabel'].forEach((definition) => {
  assert(optionsJs.includes(definition), `restored workspace should define ${definition}`);
});
assert(!/renderEvidence|aiCopilot|btn-ai-draft|btn-import-guidelines/i.test(optionsJs), 'removed Evidence and AI behavior should stay absent');
assert(!manifest.host_permissions.some((origin) => origin.includes('openai.com') || origin.includes('deepseek.com')), 'active core must not request AI provider access');
assert(optionsJs.includes('sub-journal-url'), 'new submission flow should accept a detected portal URL');
assert(optionsJs.includes('submission-capture-review'), 'captured portal data should open a human review panel');
assert(optionsJs.includes('sub-capture-project-title'), 'capture review should require a new project name');
assert(optionsJs.includes('captureProvenance'), 'confirmed captures should retain local provenance and confidence');
assert(optionsJs.includes("reviewedByUser: true"), 'captured information should only be marked reviewed after confirmation');
assert(optionsJs.includes('sub-edit-first-author'), 'submission editor should expose a first-author module');
assert(optionsJs.includes('pipeline-first-author'), 'dashboard pipeline cards should render first-author information');
assert(optionsJs.includes('btn-pipeline-share'), 'dashboard pipeline cards should expose a one-click share-image action');
assert(optionsJs.includes('createSubmissionShareCanvas'), 'submission journeys should be rendered into a local canvas image');
assert(optionsJs.includes('canvas.toBlob'), 'share images should be encoded as PNG blobs without remote services');
assert(optionsJs.includes("navigator.canShare?.({ files: [file] })"), 'share previews should use native file sharing only when supported');
assert(optionsJs.includes('navigator.clipboard.write([new ClipboardItem'), 'share previews should support copying the generated PNG');
assert(optionsCss.includes('.share-preview-card'), 'generated journey images should use a dedicated responsive preview');
assert(optionsCss.includes('.btn-pipeline-share'), 'the homepage share shortcut should have a dedicated visual treatment');
assert(optionsJs.includes('SHARE_PREFS_STORAGE_KEY'), 'share-image visibility choices should persist across previews');
assert(optionsJs.includes('normalizeShareVisibility'), 'share-image visibility settings should retain safe defaults');
['title', 'journal', 'author', 'status', 'duration', 'dates', 'footer'].forEach((field) => {
  assert(optionsJs.includes(`[\'${field}\', \'shareField`) || optionsJs.includes(`['${field}', 'shareField`), `share controls should expose ${field}`);
});
assert(optionsCss.includes('.share-visibility-chip'), 'share-image fields should use accessible visibility controls');
assert(optionsJs.includes('id="share-image-size"'), 'share studio should expose optimized image-size presets');
assert(shareRenderer.includes("v.size === 'story'"), 'share renderer should support a taller story composition');
assert(optionsHtml.indexOf('../scripts/share-card.js') < optionsHtml.indexOf('../scripts/options.js'), 'renderer must load before the workspace');
assert(optionsJs.includes('id="share-appearance"'), 'share studio exposes card appearance');
for (const appearanceKey of ['shareCyber', 'shareAurora', 'shareTerminal']) assert(optionsJs.includes(appearanceKey), `${appearanceKey} should be available in Share Studio`);
assert(optionsJs.includes('activeSharePreviewCleanup'), 'share generation must be cancelled when the modal closes');
assert(!optionsJs.includes('pipeline-first-author-index'), 'dashboard first-author typography should not use a competing number badge');
assert(
  /\.pipeline-first-author\s*\{[\s\S]*?font:\s*inherit;[\s\S]*?font-size:\s*11px;/.test(optionsCss),
  'dashboard first-author typography should inherit the metadata font at the shared size'
);
assert(
  /\$\{t\('timelineDateSource'\)\}:[\s\S]{0,500}pipeline-first-author/.test(optionsJs),
  'dashboard first-author entry should follow the submission date source'
);
assert(optionsJs.includes('captureDetailsEnabled'), 'automatic detailed capture should have an independent setting');
assert(optionsJs.includes('function setupSubmissionAutoSave'), 'submission editor should configure automatic persistence');
assert(optionsJs.includes("editCenter.addEventListener('input'"), 'text fields should trigger debounced automatic persistence');
assert(optionsJs.includes("editCenter.addEventListener('change'"), 'select, date, and checklist changes should persist immediately');
assert(optionsJs.includes("renderDetails: false"), 'automatic persistence should preserve editor focus instead of rerendering the form');
assert(optionsJs.includes('lastSavedSnapshot'), 'automatic persistence should skip duplicate blur saves');
assert(optionsJs.includes('data-submission-autosave-status'), 'submission editor should expose accessible automatic save state');
assert(!optionsJs.includes('id="btn-save-sub-edit-center"'), 'submission editor should not require a standalone save button');
assert(
  /body\.submission-capture-mode \.modal-backdrop,[\s\S]*?body\.academic-capture-mode \.modal-backdrop\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?background:\s*transparent;/.test(optionsCss),
  'capture review should leave the workspace visible and interactive'
);
assert(
  /\.modal-card\.submission-capture-card,[\s\S]*?\.modal-card\.academic-capture-card\s*\{[\s\S]*?width:\s*clamp\(520px,\s*46vw,\s*680px\);[\s\S]*?max-height:\s*calc\(100vh - 48px\);[\s\S]*?pointer-events:\s*auto;/.test(optionsCss),
  'capture review should use a bounded non-blocking side card'
);
assert(optionsJs.includes('findAcademicManuscriptMatch'), 'Scholar capture should prevent duplicate manuscripts');
assert(!optionsJs.includes('id="man-proj-select"'), 'manuscript editor should not expose the retired project context selector');
assert(!optionsJs.includes("t('linkedProjectContext')"), 'manuscript editor should not render the retired project context label');
assert(!optionsJs.includes("document.getElementById('man-proj-select')"), 'manuscript editor save should not read a retired project selector');
assert(
  /legacy relationship on edits[\s\S]{0,220}new manuscripts stay independent/.test(optionsJs),
  'manuscript editor should preserve legacy project data without creating new project context'
);
assert(optionsJs.includes('openAcademicCaptureChooser'), 'multiple Scholar results should require an explicit selection');
assert(optionsJs.includes('academicCaptureProvenance: man.academicCaptureProvenance'), 'database import should preserve Scholar provenance');
assert(optionsJs.includes('previousSubmissionId: sub.previousSubmissionId'), 'database import should preserve transfer lineage');
assert(optionsJs.includes('roundIndex: Number.isFinite(Number(sub.roundIndex))'), 'database import should preserve the submission round');
assert(optionsJs.includes('complianceChecklistKeys: Array.isArray(sub.complianceChecklistKeys)'), 'database import should preserve custom checklist definitions');
assert(optionsJs.includes('const allSubmissions = db.submissions;'), 'dashboard totals should include completed and rejected submission attempts');
assert(optionsJs.includes("const explicitStatus = normalizeSubmissionStatus(sub.status || 'submitted');"), 'dashboard state labels should use the explicit submission status');
assert(optionsHtml.includes('id="card-filter-all" aria-pressed="true"'), 'dashboard filters should expose keyboard-accessible button state');
assert(optionsJs.includes("window.addEventListener('pagehide', flushPendingSave)"), 'pending editor changes should flush when the page closes');
assert(optionsJs.includes('findExistingCapturedSubmission'), 'captured submissions should be checked for duplicates');
assert(optionsJs.includes('sanitizeDatabaseForExternalUse'), 'database export should redact device credentials');
assert(optionsJs.includes('function normalizeSubmissionStatus'), 'legacy submission status aliases should normalize to one canonical enum');
assert(optionsJs.includes('openLinkSubmissionModal'), 'detached submissions should provide a direct manuscript-linking flow');
assert(optionsJs.includes('recordEntityDeletion'), 'submission deletion should create a synchronization tombstone');
assert(optionsJs.includes('function showAcceptanceCelebration'), 'accepted submissions should trigger the milestone celebration');
assert(optionsJs.includes("window.matchMedia?.('(prefers-reduced-motion: reduce)')"), 'celebration motion should honor reduced-motion preferences');
assert(optionsJs.includes('window.RFUI.shouldCelebrateAcceptance'), 'celebration should use a tested one-time status-transition guard');
assert(
  optionsJs.indexOf('await window.storage.saveAll(workingDatabase') < optionsJs.indexOf('if (shouldCelebrate) showAcceptanceCelebration(savedSub)'),
  'celebration should run only after the accepted state is persisted'
);
assert(optionsJs.includes('structuredClone(db)'), 'submission edits should be applied to an isolated transaction copy');
assert(optionsJs.includes('function refreshSubmissionStatusPresentation'), 'auto-save should refresh status chrome without rebuilding the active form');
assert(optionsJs.includes('function persistManuscriptStatusChange'), 'kanban status changes should use an isolated persistence transaction');
assert(optionsJs.includes('showAcceptanceCelebration({ title: result.manuscript.title'), 'kanban acceptance should share the milestone celebration');
assert(optionsJs.includes('data-submission-status-badge="stage"'), 'submission details should expose a lightweight stage badge update target');
assert(optionsJs.includes('data-submission-status-badge="editor"'), 'submission editor should expose a lightweight status badge update target');
assert(optionsCss.includes('.acceptance-celebration'), 'acceptance celebration should use the workspace visual system');
assert(
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.acceptance-confetti-field\s*\{[\s\S]*?display:\s*none;/.test(optionsCss),
  'reduced-motion mode should suppress falling confetti'
);
assert(!optionsJs.includes('data-editor-mount-badge'), 'internal render-version badges should not appear in the submission workflow');
assert(optionsHtml.includes('class="submission-tools-row"'), 'journal shortcuts should use a dedicated row instead of crowding the page title');
assert(optionsHtml.includes('data-sync-provider="webdav"'), 'WebDAV settings should support provider-specific progressive disclosure');
assert(optionsHtml.includes('data-sync-provider="github"'), 'GitHub settings should support provider-specific progressive disclosure');
assert(optionsHtml.includes('id="language-auto-save-status"'), 'language settings should communicate automatic persistence');
assert(!optionsHtml.includes('id="btn-save-language"'), 'language selection should not require a separate save button');
assert(optionsHtml.includes('id="btn-restore-import-backup"'), 'settings should expose recovery from the last pre-import backup');
assert(optionsHtml.includes('id="btn-export-diagnostics"'), 'settings should provide a privacy-safe diagnostic export');
assert(optionsJs.includes('credentialsIncluded: false'), 'diagnostic exports should explicitly exclude credentials');
assert(optionsJs.includes('manuscriptMetadataIncluded: false'), 'diagnostic exports should exclude manuscript metadata');
assert(
  optionsHtml.includes('id="modal-container" aria-hidden="true" inert'),
  'the initially hidden modal should be removed from focus navigation'
);
assert(optionsJs.includes("modal.inert = false"), 'opening a modal should make its controls focusable');
assert(optionsJs.includes("modal.inert = true"), 'closing a modal should disable its controls before hiding them');
assert(
  /function closeModal\(\)[\s\S]*?restoreTarget\.focus\(\{ preventScroll: true \}\)[\s\S]*?modal\.setAttribute\('aria-hidden', 'true'\)/.test(optionsJs),
  'modal close should restore focus before hiding the focused dialog subtree'
);
assert(optionsJs.includes("new Blob([JSON.stringify(safeDb, null, 2)]"), 'large database exports should use a Blob rather than a data URI');
assert(optionsJs.includes('MAX_IMPORT_BYTES'), 'database imports should enforce a bounded input size');
assert(optionsJs.includes('PRE_IMPORT_BACKUP_KEY'), 'database imports should create a recoverable pre-import snapshot');
assert(
  optionsJs.indexOf('[PRE_IMPORT_BACKUP_KEY]') < optionsJs.indexOf('db = await window.storage.saveAll(normalizedImport,'),
  'the recovery snapshot should be written before imported data replaces the active database'
);
assert(optionsJs.includes("document.querySelector('[data-global-toast]')"),
  'global toast updates should reuse one live status element');
assert(optionsJs.includes("toast.setAttribute('role', 'status')"),
  'global toast should expose non-blocking updates to assistive technology');
assert(optionsJs.includes('clearTimeout(toast._hideTimer)'),
  'repeated toast updates should reset the pending dismissal timer');

console.log('restored main workspace tests passed');
