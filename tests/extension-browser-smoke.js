const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true });
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'researchflow-qa-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce'
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const url = `chrome-extension://${id}/pages/options.html`;
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', e => { errors.push(e.message); console.error('PAGE:', e.message); });
    page.on('console', msg => { if (msg.type() === 'error') { errors.push(msg.text()); console.error(msg.text()); } });
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url);
    await page.locator('.btn-pipeline-share').first().waitFor({ timeout: 15000 }).catch(async e => { console.log(await page.locator('body').innerText()); throw e; });
    await page.locator('[data-view="view-submissions"]').click();
    await page.locator('.btn-edit-submission').first().click();
    const title = '真实扩展 QA α 🧪 ' + Date.now();
    await page.locator('#sub-edit-title').fill(title);
    // Switch before the debounce expires: the old editor must still commit its snapshot.
    await page.locator('.btn-edit-submission').nth(1).click();
    await page.waitForFunction(async title => {
      const { researchflow_db: db } = await chrome.storage.local.get('researchflow_db');
      return db.manuscripts.some(m => m.title === title) || db.submissions.some(s => s.title === title);
    }, title);
    const editorBeforeSearch = await page.locator('#sub-edit-title').inputValue();
    await page.locator('#submission-search').fill(title);
    assert.equal(await page.locator('.submission-card-item:visible').count(), 1);
    await page.locator('#submission-search').fill('no-match-qa-unique');
    assert.equal(await page.locator('.submission-card-item:visible').count(), 0);
    assert.equal(await page.locator('#sub-edit-title').inputValue(), editorBeforeSearch);
    await page.locator('#submission-search').fill('');
    const second = await context.newPage();
    second.on('pageerror', e => errors.push(e.message));
    await second.goto(url);
    await second.locator('.btn-pipeline-share').first().waitFor();
    const db = await second.evaluate(async () => (await chrome.storage.local.get('researchflow_db')).researchflow_db);
    assert(db.manuscripts.some(m => m.title === title) || db.submissions.some(s => s.title === title));
    const conflict = await second.evaluate(async () => {
      const r = await chrome.runtime.sendMessage({ action: 'LOAD_DATABASE' });
      return chrome.runtime.sendMessage({ action: 'SAVE_DATABASE', data: { ...r.data, revision: -1 } });
    });
    assert.equal(conflict.success, false);
    await second.close();
    await page.evaluate(async () => {
      const result = await chrome.runtime.sendMessage({ action: 'LOAD_DATABASE' });
      result.data.submissions[0].captureProvenance = { sourceOrigin: 'https://example.invalid', marker: 'roundtrip' };
      result.data.deletedEntities.manuscripts = [{ id: 'deleted-qa', deletedAt: new Date().toISOString(), deviceId: 'qa' }];
      const saved = await chrome.runtime.sendMessage({ action: 'SAVE_DATABASE', data: result.data });
      if (!saved.success) throw new Error(saved.error);
    });
    await page.locator('[data-view="view-settings"]').click();
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#btn-export-db').click();
    const download = await downloadEvent;
    const backupPath = path.join(root, 'output/playwright/real-extension-backup.json');
    await download.saveAs(backupPath);
    const exported = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert(exported.manuscripts || exported.data?.manuscripts);
    await page.locator('#import-db-file').setInputFiles(backupPath);
    await page.waitForFunction(async () => Boolean((await chrome.storage.local.get(null)).researchflow_pre_import_backup));
    await page.waitForFunction(async () => {
      const { researchflow_db: db } = await chrome.storage.local.get('researchflow_db');
      return db.submissions.some(s => s.captureProvenance?.marker === 'roundtrip') && db.deletedEntities.manuscripts.some(m => m.id === 'deleted-qa') && !document.querySelector('#import-db-file').value;
    });
    await page.locator('#btn-restore-import-backup').click();
    await page.waitForTimeout(500);
    await page.reload();
    await page.locator('.btn-pipeline-share').first().waitFor();
    // A toolbar click should activate the existing page without reloading its editor state.
    await page.evaluate(() => { globalThis.__qaMarker = 'keep-editor'; });
    await worker.evaluate(() => openWorkspacePage());
    assert.equal(await page.evaluate(() => globalThis.__qaMarker), 'keep-editor');
    const cdp = await context.newCDPSession(page);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    const restarted = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'LOAD_DATABASE' }));
    assert.equal(restarted.success, true);
    assert(restarted.data.submissions.some(s => s.captureProvenance?.marker === 'roundtrip'));
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(root, 'output/playwright/real-extension-dashboard.png'), fullPage: true });
    const timings = await page.evaluate(() => {
      const original = db;
      const selected = selectedSubmissionId;
      const measurements = [];
      try {
        for (const size of [100, 1000]) {
          db = structuredClone(original);
          db.manuscripts = Array.from({ length: size }, (_, i) => ({ ...original.manuscripts[0], id: `bench-m-${i}`, title: `Synthetic ${i}` }));
          db.submissions = Array.from({ length: size }, (_, i) => ({ ...structuredClone(original.submissions[0]), id: `bench-s-${i}`, manuscriptId: `bench-m-${i}` }));
          const start = performance.now();
          renderSubmissions();
          measurements.push({ submissions: size, renderMs: Math.round((performance.now() - start) * 10) / 10 });
        }
      } finally { db = original; selectedSubmissionId = selected; renderSubmissions(); }
      return measurements;
    });
    fs.writeFileSync(path.join(root, 'output/playwright/performance.json'), JSON.stringify(timings, null, 2));
    console.log('Synthetic list rendering (single run, not a comparative benchmark):', JSON.stringify(timings));
    assert.deepEqual(errors, []);
    console.log('Real MV3 extension smoke passed: initialization, autosave navigation, two pages, stale revision, export/import/restore, reload, toolbar focus, service-worker restart.');
  } finally { await context.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
