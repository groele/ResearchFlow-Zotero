const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');

function fixture() {
  const stamp = '2026-09-01T12:00:00Z';
  const manuscript = (id, title, status, journal) => ({ id, title, status, targetJournals: [journal], targetJournal: journal, createdAt: stamp, updatedAt: stamp });
  const submission = (id, manuscriptId, status, journal, date) => ({
    id, manuscriptId, status, targetJournal: journal, journalName: journal,
    submissionDate: date, submittedAt: date, createdAt: stamp, updatedAt: stamp,
    complianceChecklist: {}, reviewMatrix: [], timelineNodes: [],
    manuscript: { id: manuscriptId, title: 'Legacy nested title', status, targetJournal: journal }
  });
  const db = JSON.parse(fs.readFileSync(path.join(root, 'data/preloaded_db.json'), 'utf8'));
  db.settings = { profile: { language: 'en' }, syncProviders: { metadata: { provider: 'local', config: {}, autoSync: false } } };
  db.manuscripts = [manuscript('m-one', 'Published workflow', 'published', 'Journal A'), manuscript('m-two', 'Current workflow', 'under_review', 'Journal B')];
  db.submissions = [submission('s-one', 'm-one', 'accepted', 'Journal A', '2026-01-01'), submission('s-old', 'm-two', 'rejected', 'Old Journal', '2026-02-01'), submission('s-two', 'm-two', 'under_review', 'Journal B', '2026-08-01')];
  Object.assign(db.submissions[0], { decisionDate: '2026-02-15', doi: '10.1000/qa', timelineNodes: [{ id: 'online-one', key: 'online', name: 'Online Publication', status: 'completed', completeDate: '2026-03-15' }] });
  Object.assign(db.submissions[2], { previousSubmissionId: 's-old', roundIndex: 2 });
  return db;
}

async function exercise(page, readDatabase) {
  await page.waitForFunction(() => window._researchflowWorkspaceReady === true);
  const templateSafety = await page.evaluate(() => {
    const target = document.createElement('div');
    window.RFUI.setHTML(target, '<button data-qa="control" onclick="alert(1)">Edit</button><select><option selected>Selected</option></select><script>alert(1)</script><a href="java&#x0A;script:alert(1)">Unsafe</a>');
    return { button: !!target.querySelector('[data-qa="control"]'), selected: target.querySelector('select')?.value, script: !!target.querySelector('script'), handler: target.querySelector('button')?.hasAttribute('onclick'), unsafeUrl: target.querySelector('a')?.hasAttribute('href') };
  });
  assert.deepEqual(templateSafety, { button: true, selected: 'Selected', script: false, handler: false, unsafeUrl: false });
  let saved = await readDatabase();
  assert.equal(saved.submissions.find(s => s.id === 's-one').status, 'published');
  assert.equal(saved.submissions.find(s => s.id === 's-one').timelineNodes.find(n => n.key === 'online').completeDate, '2026-03-15', 'online publication must retain its own date');
  await page.locator('[data-view="view-submissions"]').click();
  await page.locator('.btn-edit-submission[data-sub-id="s-two"]').click();
  assert.equal(await page.locator('#sub-edit-status').inputValue(), 'under_review');
  await page.locator('[data-view="view-manuscripts"]').click();
  await page.locator('#sel-man-status-m-two').selectOption('accepted');
  await page.waitForFunction(() => document.querySelector('#sel-man-status-m-two')?.value === 'accepted' && !document.querySelector('.kanban-card-select:disabled'));
  await page.locator('[data-view="view-submissions"]').click();
  await page.waitForFunction(() => document.querySelector('#sub-edit-status')?.value === 'accepted');
  await page.locator('#sub-edit-title').fill('Shared edited title');
  await page.locator('#sub-edit-journal').fill('Shared Journal');
  await page.locator('#sub-edit-submission-date').fill('2026-08-05');
  await page.locator('#sub-edit-status').selectOption('revision');
  await page.waitForFunction(() => document.querySelector('[data-submission-autosave-status]')?.dataset.state === 'saved');
  saved = await readDatabase();
  const man = saved.manuscripts.find(m => m.id === 'm-two');
  const sub = saved.submissions.find(s => s.id === 's-two');
  assert.equal(man.status, 'revision', 'submission edits must update the saved transaction copy');
  assert.equal(man.title, 'Shared edited title');
  assert.equal(man.targetJournal, 'Shared Journal');
  assert.equal(sub.journalName, 'Shared Journal');
  assert.equal(sub.submittedAt.slice(0, 10), '2026-08-05');
  assert.equal(sub.manuscript.title, 'Shared edited title');
  assert.equal(sub.manuscript.status, 'revision');
  assert.equal(saved.submissions.find(s => s.id === 's-old').status, 'rejected', 'historical attempts must remain unchanged');
  assert.equal(saved.submissions.find(s => s.id === 's-old').targetJournal, 'Old Journal');
  await page.locator('[data-view="view-dashboard"]').click();
  await page.locator('.pipeline-card').filter({ hasText: 'Shared edited title' }).waitFor();
  await page.locator('.interactive-dot[data-sub-id="s-two"]').first().click();
  assert.equal(await page.locator('#drawer-node-key').inputValue(), 'submit');
  await page.locator('#drawer-node-date').fill('2026-08-07');
  await page.locator('#drawer-btn-save').click();
  await page.locator('#modal-container').waitFor({ state: 'hidden' });
  await page.locator('[data-view="view-submissions"]').click();
  assert.equal(await page.locator('#sub-edit-submission-date').inputValue(), '2026-08-07');
  assert.equal(await page.locator('#sub-edit-status').inputValue(), 'revision', 'editing the submission date must not reset review progress');
  await page.locator('[data-view="view-manuscripts"]').click();
  assert.equal(await page.locator('#sel-man-status-m-two').inputValue(), 'revision');
  await page.locator('#btn-edit-man-m-two').click();
  await page.locator('#man-title').fill('Edited from Kanban');
  await page.locator('#man-journal').fill('Kanban Journal');
  await page.locator('#man-authors').fill('QA Author');
  await page.locator('#btn-submit-man').click();
  await page.locator('#modal-container').waitFor({ state: 'hidden' });
  await page.locator('[data-view="view-submissions"]').click();
  assert.equal(await page.locator('#sub-edit-title').inputValue(), 'Edited from Kanban');
  assert.equal(await page.locator('#sub-edit-journal').inputValue(), 'Kanban Journal');
  assert.equal(await page.locator('#sub-edit-first-author').inputValue(), 'QA Author');
  await page.reload();
  await page.waitForFunction(() => window._researchflowWorkspaceReady === true);
  await page.locator('[data-view="view-submissions"]').click();
  await page.locator('.btn-edit-submission[data-sub-id="s-two"]').click();
  assert.equal(await page.locator('#sub-edit-title').inputValue(), 'Edited from Kanban');
  assert.equal(await page.locator('#sub-edit-status').inputValue(), 'revision');
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-workflow-qa-'));
  const extension = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`] });
  try {
    const worker = extension.serviceWorkers()[0] || await extension.waitForEvent('serviceworker');
    await worker.evaluate(data => chrome.storage.local.set({ researchflow_db: data }), fixture());
    const page = await extension.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/pages/options.html`);
    await exercise(page, () => page.evaluate(async () => (await chrome.storage.local.get('researchflow_db')).researchflow_db));
    assert.deepEqual(errors, []);
    console.log('Real MV3 cross-view workflow smoke passed.');
  } finally { await extension.close(); }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript({ path: path.join(__dirname, 'fixtures/chrome-mock.js') });
    await page.addInitScript(data => {
      window.__qaHostDb = JSON.parse(sessionStorage.getItem('qa-host-db') || 'null') || data;
      window.Zotero = { ResearchFlow: {
        loadDatabase: async () => structuredClone(window.__qaHostDb),
        saveDatabase: async next => {
          window.__qaHostDb = structuredClone(next);
          sessionStorage.setItem('qa-host-db', JSON.stringify(next));
          window.postMessage({ type: 'RESEARCHFLOW_DATA_UPDATED', data: structuredClone(next) }, '*');
          return structuredClone(next);
        },
        getCollections: async () => [], getCurrentActiveItem: () => null
      } };
    }, fixture());
    await page.goto('http://127.0.0.1:8765/pages/options.html');
    await exercise(page, () => page.evaluate(() => window.__qaHostDb));
    assert.deepEqual(errors, []);
    console.log('Zotero host API cross-view workflow smoke passed (host and Chrome APIs mocked).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
