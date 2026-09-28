const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'chrome/content/scripts/index.js'), 'utf8');
const method = source.slice(source.indexOf('    async saveShareImageFile('), source.indexOf('    async exportDatabaseFile('));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1kAAAAASUVORK5CYII=', 'base64');

function host(options = {}) {
  const state = { writes: [], dialogs: [] };
  class FilePicker {
    constructor() { Object.assign(this, { modeSave: 1, returnOK: 0, returnReplace: 2, file: options.filePath || '/test/image.png' }); }
    init(win, title, mode) { state.dialogs.push({ win, title, mode, picker: this }); }
    appendFilter(name, filter) { this.filter = filter; }
    async show() { return options.show ? options.show() : (options.result ?? 0); }
  }
  const context = vm.createContext({ Uint8Array, ChromeUtils: { importESModule: () => ({ FilePicker }) },
    Zotero: { getMainWindow: () => ({ browsingContext: {} }), logError() {} }, Services: {},
    IOUtils: { async write(filePath, bytes) {
      if (options.writeError) throw new Error(options.writeError);
      if (options.realWrite) await fs.promises.writeFile(filePath, bytes);
      state.writes.push({ filePath, bytes: Buffer.from(bytes) });
    } }
  });
  return { runtime: vm.runInContext(`({ ${method} })`, context), state };
}

test('Save As writes the exact PNG to the selected Unicode path before confirming success', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-share-'));
  const filePath = path.join(directory, '投稿历程.png');
  try {
    const { runtime, state } = host({ filePath, realWrite: true });
    const result = await runtime.saveShareImageFile(png, '投稿历程.png', 'zh');
    assert.equal(result.success, true);
    assert.equal(result.filePath, filePath);
    assert.deepEqual(fs.readFileSync(filePath), png);
    assert.equal(state.dialogs[0].title, '另存为 ResearchFlow 图片');
    assert.equal(state.dialogs[0].picker.defaultExtension, 'png');
  } finally { fs.rmSync(directory, { recursive: true }); }
});
test('confirmed replacement writes the selected existing file', async () => {
  const { runtime, state } = host({ result: 2 });
  assert.equal((await runtime.saveShareImageFile(png, 'image.png')).success, true);
  assert.equal(state.writes.length, 1);
});
test('cancelling Save As writes nothing and never reports success', async () => {
  const { runtime, state } = host({ result: 1 });
  const result = await runtime.saveShareImageFile(png, 'image.png');
  assert.equal(result.cancelled, true);
  assert.equal(result.success, false);
  assert.equal(state.writes.length, 0);
});
test('write errors remain failures and release the save lock', async () => {
  const { runtime } = host({ writeError: 'Permission denied' });
  assert.equal((await runtime.saveShareImageFile(png, 'image.png')).error, 'Permission denied');
  assert.equal(runtime._shareImageSavePending, false);
});
test('invalid image data is rejected before opening a dialog', async () => {
  const { runtime, state } = host();
  assert.equal((await runtime.saveShareImageFile([1, 2, 3], 'image.png')).success, false);
  assert.equal(state.dialogs.length, 0);
});
test('duplicate clicks cannot open overlapping native save dialogs', async () => {
  let finish;
  const { runtime, state } = host({ show: () => new Promise(resolve => { finish = resolve; }) });
  const first = runtime.saveShareImageFile(png, 'first.png');
  assert.equal((await runtime.saveShareImageFile(png, 'second.png')).success, false);
  assert.equal(state.dialogs.length, 1);
  finish(0);
  assert.equal((await first).success, true);
});
test('default file names strip path separators and retain the PNG extension', async () => {
  const { runtime, state } = host();
  await runtime.saveShareImageFile(png, '../a:b?.png');
  assert.equal(state.dialogs[0].picker.defaultString, '..-a-b-.png');
});
test('bridge waits for the native dialog response with no six-second timeout', async () => {
  const listeners = {};
  let payload, timerCount = 0;
  const context = vm.createContext({ Uint8Array, Blob, console, globalThis: {},
    window: { addEventListener(type, listener) { listeners[type] = listener; }, parent: { postMessage(msg) { payload = msg; } } },
    setTimeout() { timerCount++; return 1; }, clearTimeout() {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'chrome/content/scripts/zotero-bridge.js'), 'utf8'), context);
  const bridge = context.globalThis.ZoteroBridge;
  bridge.isZotero = true;
  bridge.setupMessageListener();
  const pending = bridge.saveShareImage(new Blob([png], { type: 'image/png' }), 'image.png', 'zh');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(payload.type, 'RESEARCHFLOW_SAVE_SHARE_IMAGE');
  assert.deepEqual(Buffer.from(payload.pngBytes), png);
  assert.equal(timerCount, 0);
  listeners.message({ data: { requestId: payload.requestId, success: true, filePath: '/chosen/image.png' } });
  assert.equal((await pending).filePath, '/chosen/image.png');
  assert.equal(bridge._requestCallbacks.size, 0);
});
