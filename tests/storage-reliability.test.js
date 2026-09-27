const assert = require('node:assert/strict');
const values = {};
let failWrite = false;
global.chrome = {
  storage: { local: {
    get(keys, callback) { callback(values); },
    set(next, callback) {
      if (failWrite) chrome.runtime.lastError = { message: 'disk full' };
      else Object.assign(values, structuredClone(next));
      callback?.();
      chrome.runtime.lastError = null;
    }
  } },
  runtime: { sendMessage() { return Promise.resolve(); } }
};
require('../scripts/storage.js');
const engine = global.storage;
const defer = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

(async () => {
  const initial = await engine.ensureDbShape({ revision: 1, manuscripts: [] }, { stamp: false });
  engine.cache = initial;
  failWrite = true;
  await assert.rejects(engine.saveAll(structuredClone(initial)), /disk full/);
  assert.equal(engine.cache, initial, 'failed persistence must not publish a committed snapshot');
  failWrite = false;

  const download = defer();
  const upload = defer();
  const uploaded = defer();
  engine.getEffectiveMetadataProvider = async () => ({ provider: 'github', config: { repo: 'owner/repo', token: 'test' } });
  engine.fetchFromGitHub = () => download.promise;
  let sent;
  engine.saveToCloud = async (_provider, _config, data) => {
    sent = structuredClone(data);
    uploaded.resolve();
    await upload.promise;
  };
  let scheduled = 0;
  engine.scheduleBackgroundSync = () => scheduled++;
  const syncing = engine.syncDatabaseNow();
  // A user saves while the remote download is in flight.
  await engine.enqueueCommit(() => engine.saveAll({ ...initial, manuscripts: [{ id: 'during-download', title: 'Keep me', updatedAt: '2026-09-06T01:00:00Z' }] }));
  download.resolve(await engine.ensureDbShape({ manuscripts: [{ id: 'remote', title: 'Remote' }] }, { stamp: false }));
  await uploaded.promise;
  assert(sent.manuscripts.some(item => item.id === 'during-download'));
  assert(sent.manuscripts.some(item => item.id === 'remote'));
  // A second user edit lands while upload is in flight.
  await engine.enqueueCommit(() => engine.saveAll({ ...engine.cache, manuscripts: [...engine.cache.manuscripts, { id: 'during-upload', title: 'Keep this too' }] }));
  upload.resolve();
  const result = await syncing;
  assert.equal(result.success, true);
  assert.equal(result.pending, true);
  assert(engine.cache.manuscripts.some(item => item.id === 'during-upload'));
  assert(values.researchflow_db.manuscripts.some(item => item.id === 'during-upload'));
  assert(scheduled > 0);

  engine.fetchFromGitHub = async () => { throw new Error('offline'); };
  assert.equal((await engine.syncDatabaseNow()).success, false);
  assert.equal(engine.syncing, false, 'failed network requests must release the sync lock');
  global.fetch = async (_url, options) => {
    assert(options.signal instanceof AbortSignal, 'network requests need a bounded abort signal');
    return { ok: true };
  };
  await engine.fetchWithTimeout('https://example.invalid');

  global.window = {};
  chrome.runtime.sendMessage = (_message, callback) => {
    chrome.runtime.lastError = { message: 'Background unavailable' };
    callback();
    chrome.runtime.lastError = null;
  };
  const persisted = JSON.stringify(values.researchflow_db);
  await assert.rejects(engine.saveAll({ manuscripts: [] }), /Background unavailable/);
  assert.equal(JSON.stringify(values.researchflow_db), persisted, 'page cannot bypass the writer');
  delete global.window;
  console.log('storage reliability tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
