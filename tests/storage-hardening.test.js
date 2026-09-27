const assert = require('node:assert/strict');
const values = {};
let failWrite = false;
let writes = 0;
let changes;
global.chrome = {
  storage: { onChanged: { addListener(fn) { changes = fn; } }, local: {
    get(_keys, cb) { setImmediate(() => cb(structuredClone(values))); },
    set(next, cb) {
      writes++;
      if (failWrite) chrome.runtime.lastError = { message: 'disk full' };
      else Object.assign(values, structuredClone(next));
      cb?.(); chrome.runtime.lastError = null;
    }
  } },
  runtime: { getURL: p => p, sendMessage: () => Promise.resolve() }
};
require('../scripts/storage.js');
const engine = global.storage;
(async () => {
  values.researchflow_db = { revision: 3, deviceId: 'test', manuscripts: [{ id: 'one', title: '中文 α 🧪' }] };
  const [one, two] = await Promise.all([engine.loadAll(), engine.loadAll()]);
  assert.equal(one, two);
  assert.equal(writes, 1, 'concurrent initialization must share a single migration write');
  await engine.saveSyncCredentials('github', { token: 'old' });
  failWrite = true;
  await assert.rejects(engine.saveSyncCredentials('github', { token: 'new' }), /disk full/);
  assert.equal((await engine.loadSyncCredentials()).github.token, 'old');
  failWrite = false;
  values.researchflow_sync_credentials = { github: { token: 'external-change' } };
  changes({ researchflow_sync_credentials: {} }, 'local');
  assert.equal((await engine.loadSyncCredentials()).github.token, 'external-change');
  let requestedUrl;
  engine.fetchWithTimeout = async url => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ sha: 'test-sha', content: Buffer.from(JSON.stringify(one), 'utf8').toString('base64') }) };
  };
  const downloaded = await engine.fetchFromGitHub({ repo: 'owner/repo', branch: 'topic/中文&test', token: 'test' });
  assert.equal(downloaded.manuscripts[0].title, '中文 α 🧪');
  assert.equal(new URL(requestedUrl).searchParams.get('ref'), 'topic/中文&test');
  const merged = engine.deepMerge({}, JSON.parse('{"__proto__":{"polluted":true},"nested":{"__proto__":{"polluted":true}}}'));
  assert.equal(merged.polluted, undefined);
  assert.equal(merged.nested.polluted, undefined);
  assert.equal({}.polluted, undefined);
  engine.cache = null;
  const before = writes;
  global.window = {};
  chrome.runtime.sendMessage = (message, cb) => { assert.equal(message.action, 'LOAD_DATABASE'); cb({ success: true, data: one }); };
  assert.equal((await engine.loadAll()).revision, 3);
  assert.equal(writes, before, 'opening a page must not write a stale database');
  chrome.runtime.sendMessage = () => {};
  await assert.rejects(engine.sendRequest({ action: 'test' }, 5), /timed out/);
  delete global.window;
  console.log('storage hardening tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
