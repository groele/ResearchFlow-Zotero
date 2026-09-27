const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'output/playwright');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'researchflow-share-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`], viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const urls = new Set();
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url; };
      URL.revokeObjectURL = url => { urls.delete(url); return revoke(url); };
      globalThis.__shareUrls = urls;
    });
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/pages/options.html`);
    await page.locator('.btn-pipeline-share').first().waitFor();
    const measurements = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d');
      const results = [];
      for (const language of ['en', 'zh']) for (const appearance of ['paper', 'ink', 'blueprint', 'minimal', 'cyber', 'aurora', 'terminal', 'journal', 'conference', 'archive', 'estuary', 'iris', 'amber']) for (const brandSize of ['compact', 'balanced', 'bold']) for (const count of [0, 1, 4, 8, 30, 100]) {
        const model = {
          language, title: (language === 'zh' ? '铁电界面中激子动力学的超长标题与中文混合ABC ' : 'LongManuscriptIdentifierWithoutSpaces'.repeat(3) + ' Multiword research title ') .repeat(4),
          journal: 'International Journal of Long Journal Names and Multidisciplinary Research', author: 'First author with an unusually long affiliation-like name '.repeat(4),
          duration: 128, durationLabel: 'From submission to acceptance / publication', status: 'Under review',
          events: Array.from({ length: count }, (_, i) => ({ name: `Milestone ${i + 1} — ${'Extended title '.repeat(8)}`, typeLabel: 'Research', dateKindLabel: 'Recorded', dateLabel: 'Sep 19', yearLabel: '2026', completed: i % 2 === 0 }))
        };
        const layout = RFShareCard.buildLayout(ctx, model, { appearance, brandSize, size: 'auto' });
        if (layout.height > 10000) throw new Error('Unbounded image height');
        const brandLines = layout.blocks.filter(b => ['brand-wordmark', 'brand-motto'].includes(b.role));
        for (const b of brandLines) {
          if (Math.abs(b.x + b.width / 2 - 592) > .1) throw new Error('Brand lines must share the seal center');
        }
        if (brandLines[0].y + brandLines[0].height > brandLines[1].y - 3) throw new Error('Brand line spacing is too tight');
        if (brandLines[1].y + brandLines[1].height > layout.headerBottom - 20) throw new Error('Brand needs clearance above section rule');
        for (const block of layout.blocks.filter(b => b.kind === 'text')) {
          if (block.y < layout.headerBottom && block.x < 519 && block.x + block.width > 496) throw new Error(`Brand collision: ${block.role}`);
          ctx.font = block.font;
          if (ctx.measureText(block.text).width > block.width + 1) throw new Error(`Text overflow: ${block.role}`);
          if (block.y + block.height > layout.height - 16) throw new Error(`Bottom clipping: ${block.role}`);
        }
        if (layout.eventCount !== Math.min(count, 64)) throw new Error('Missing milestones');
        const hidden = RFShareCard.buildLayout(ctx, model, { appearance, dates: false, title: false, author: false, journal: false, status: false, duration: false, footer: false });
        const roles = new Set(hidden.blocks.map(block => block.role));
        for (const role of ['event-date', 'event-year', 'title', 'author', 'journal', 'status', 'duration', 'footer-brand', 'brand-seal', 'brand-wordmark', 'brand-motto']) {
          if (roles.has(role)) throw new Error(`Hidden field leaked: ${role}`);
        }
        results.push({ language, appearance, brandSize, count, height: layout.height });
      }
      return results;
    });
    fs.writeFileSync(path.join(out, 'share-layout-cases.json'), JSON.stringify(measurements, null, 2));
    const longExport = await page.evaluate(() => {
      const { canvas, resolutionLimited } = RFShareCard.render({ language: 'zh', journal: 'Small', events: Array.from({length: 100}, () => ({name: '长节点标题'.repeat(18), typeLabel: '审稿', dateKindLabel: '已记录'})) }, {resolution: 3, size: 'auto', brandSize: 'bold'});
      const result = {pixels: canvas.width * canvas.height, height: canvas.height, resolutionLimited};
      canvas.width = canvas.height = 1;
      return result;
    });
    assert(longExport.resolutionLimited && longExport.pixels <= 24000000 && longExport.height <= 16384, 'long exports must be bounded before allocating the bitmap');
    await page.locator('.btn-pipeline-share').first().click();
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    assert.equal(await page.locator('[data-share-style]').count(), 13);
    await page.locator('[data-share-style="iris"]').click();
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.appearance === 'iris' && document.querySelector('.share-preview-frame').dataset.renderState === 'ready');
    assert.equal(await page.locator('#share-appearance').inputValue(), 'iris');
    assert.equal(await page.locator('[data-share-style="iris"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#share-brand-size').selectOption('bold');
    await page.locator('#share-resolution').selectOption('3');
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    assert((await page.locator('#share-output-details').innerText()).startsWith('2160 ×'));
    await page.evaluate(() => {
      const render = RFShareCard.render;
      RFShareCard.render = (...args) => { RFShareCard.render = render; throw new Error('Injected one-time render failure'); };
    });
    await page.locator('#share-brand-size').selectOption('compact');
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'error');
    assert(await page.locator('#btn-share-download').isDisabled());
    assert(await page.locator('.share-preview-frame img').isHidden());
    await page.locator('#btn-share-retry').click();
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    await page.locator('#btn-share-reset').click();
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    assert((await page.locator('#share-output-details').innerText()).startsWith('1440 ×'), 'default exports should retain high pixel density');
    await page.locator('#share-appearance').selectOption('paper');
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    const saveImage = async name => {
      const data = await page.locator('.share-preview-frame img').evaluate(async img => {
        const blob = await (await fetch(img.src)).blob();
        return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
      });
      fs.writeFileSync(path.join(out, name), Buffer.from(data, 'base64'));
    };
    await saveImage('share-paper-v8.png');
    for (const appearance of ['archive', 'estuary', 'iris', 'amber']) {
      const data = await page.evaluate(style => {
        return RFShareCard.render({ language: 'zh', journal: 'Small', duration: 67, durationLabel: '从投稿至今天', status: '已投稿', events: [{name: '手稿已投稿', dateLabel: '7月14日', yearLabel: '2026', typeLabel: '投稿', dateKindLabel: '已记录', completed: true}] }, {appearance: style, title: false, size: 'auto'}).canvas.toDataURL().split(',')[1];
      }, appearance);
      fs.writeFileSync(path.join(out, `small-${appearance}.png`), Buffer.from(data, 'base64'));
    }
    await page.locator('.share-visibility-panel').evaluate(panel => { panel.scrollTop = 0; });
    await page.screenshot({ path: path.join(out, 'share-studio-v9.png') });
    assert(await page.locator('.share-style-tile').evaluateAll(tiles => tiles.every(tile => tile.scrollWidth <= tile.clientWidth + 1)), 'style tiles must not overflow');
    for (const appearance of ['ink', 'blueprint', 'minimal', 'cyber', 'aurora', 'terminal', 'journal', 'conference', 'archive', 'estuary', 'iris', 'amber']) {
      await page.locator('#share-appearance').selectOption(appearance);
      await page.waitForFunction(expected => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready' && document.querySelector('.share-preview-frame').dataset.appearance === expected, appearance);
      await saveImage(`share-${appearance}-v8-1.png`);
    }
    await page.locator('.share-visibility-chip:has([data-share-field="title"])').click();
    assert(await page.locator('#btn-share-download').isDisabled(), 'old image must be disabled immediately after a privacy change');
    assert(await page.locator('.share-preview-frame img').isHidden(), 'old sensitive preview must be hidden immediately');
    await page.locator('#btn-share-reset').click();
    assert.equal(await page.locator('[data-share-field="title"]').isChecked(), false, 'design reset must not reveal hidden content');
    await page.locator('.share-visibility-chip:has([data-share-field="dates"])').click();
    await page.locator('#share-image-size').selectOption('auto');
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#btn-share-download').click();
    const download = await downloadEvent;
    assert(download.suggestedFilename().startsWith('Submission-journey'), 'hidden titles must not leak through the download filename');
    await download.saveAs(path.join(out, 'share-private-v8.png'));
    await page.locator('#share-appearance').selectOption('paper');
    await page.locator('#btn-close-modal').click();
    await page.waitForFunction(() => __shareUrls.size === 0, null, { timeout: 3000 });
    assert.equal(await page.evaluate(() => __shareUrls.size), 0, 'closing a pending preview must release all blob URLs');
    await page.locator('.btn-pipeline-share').first().click();
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    await page.locator('#btn-share-zoom').click();
    assert.equal(await page.locator('#btn-share-zoom').getAttribute('aria-pressed'), 'true');
    await page.locator('#btn-share-zoom').click();
    await page.locator('#share-brand-size').selectOption('bold');
    await page.locator('#share-resolution').selectOption('1');
    await page.locator('#btn-close-modal').click();
    await page.locator('.btn-pipeline-share').first().click();
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    assert.equal(await page.locator('#share-brand-size').inputValue(), 'bold');
    assert.equal(await page.locator('#share-resolution').inputValue(), '1');
    assert.equal(await page.locator('[data-share-field="title"]').isChecked(), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.share-preview-workbench').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: path.join(out, 'share-studio-mobile-v9.png') });
    await page.locator('#share-resolution').scrollIntoViewIfNeeded();
    const mobileControl = await page.locator('#share-resolution').boundingBox();
    const mobileActions = await page.locator('.share-preview-actions').boundingBox();
    assert(mobileControl.y + mobileControl.height <= mobileActions.y + 1, 'mobile export settings must be reachable above the action bar');
    const downloadBounds = await page.locator('#btn-share-download').boundingBox();
    assert(downloadBounds.y >= 0 && downloadBounds.y + downloadBounds.height <= 844, 'mobile download action must fit the viewport');
    assert(await page.locator('#btn-share-download').isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#btn-close-modal').click();
    assert.equal(await page.evaluate(() => __shareUrls.size), 0);
    await page.setViewportSize({width: 1440, height: 1000});
    await page.evaluate(() => { currentLanguage = 'zh'; applyThemePreference('dark'); });
    await page.locator('.btn-pipeline-share').first().click();
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    assert.equal(await page.locator('label[for="share-brand-size"] > span').innerText(), '品牌视觉大小');
    await page.locator('[data-share-style="iris"]').click();
    await page.waitForFunction(() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready');
    await page.locator('.share-visibility-panel').evaluate(panel => { panel.scrollTop = 0; });
    await page.screenshot({path: path.join(out, 'share-studio-zh-dark-v9.png')});
    await saveImage('share-zh-iris-v9.png');
    await page.locator('.share-visibility-chip:has([data-share-field="footer"])').click();
    assert(await page.locator('#share-brand-size').isDisabled());
    await page.locator('#btn-close-modal').click();
    assert.equal(await page.evaluate(() => __shareUrls.size), 0);
    assert.deepEqual(errors, []);
    console.log('Share card browser smoke passed: 468 layout cases, gallery, brand sizes, export quality, bounded long export, retry, privacy-safe reset, real PNG download, zoom, mobile and blob cleanup.');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
