const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

async function testZoteroUiApi() {
  const values = new Map();
  const window = {
    location: { protocol: 'chrome:', host: 'researchflow' },
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key)
    }
  };
  const context = vm.createContext({ window, console });
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts/zotero-ui-api.js'), 'utf8'), context);
  const { RFPlatform } = context;
  assert(RFPlatform?.runtime?.onMessage && RFPlatform?.storage?.local);
  const messages = [];
  RFPlatform.runtime.onMessage.addListener(message => messages.push(message));
  await RFPlatform.storage.local.set({ researchflow_pipeline_expanded: true });
  assert.equal((await RFPlatform.storage.local.get(['researchflow_pipeline_expanded'])).researchflow_pipeline_expanded, true);
  const callbackValue = await new Promise(resolve => RFPlatform.storage.local.get('researchflow_pipeline_expanded', resolve));
  assert.equal(callbackValue.researchflow_pipeline_expanded, true);
  await RFPlatform.runtime.sendMessage({ action: 'DATABASE_UPDATED', data: { revision: 2 } });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].data.revision, 2);
  await RFPlatform.storage.local.remove('researchflow_pipeline_expanded');
  assert.deepEqual(Object.keys(await RFPlatform.storage.local.get('researchflow_pipeline_expanded')), []);
  await assert.rejects(RFPlatform.runtime.sendMessage({ action: 'TRIGGER_SYNC' }), /Unsupported Zotero runtime request/);

  let nativeUi = {};
  window.Zotero = { ResearchFlow: {
    loadUiState: async () => nativeUi,
    updateUiState: async (patch, removed = []) => {
      nativeUi = { ...nativeUi, ...patch };
      for (const key of removed) delete nativeUi[key];
      return nativeUi;
    }
  } };
  await RFPlatform.storage.local.set({ pre_import_backup: { manuscripts: [{ id: 'large-backup' }] } });
  assert.equal(nativeUi.pre_import_backup.manuscripts[0].id, 'large-backup');
  await RFPlatform.storage.local.remove('pre_import_backup');
  assert.equal(nativeUi.pre_import_backup, undefined);
}

function createHost({ read = '{}', writeError = null, picks = [], importContent = '{}', nativeHooks = false } = {}) {
  const writes = [];
  const errors = [];
  const pickerUses = [];
  const mainWindow = { browsingContext: { id: 'zotero-main' } };
  class FilePicker {
    constructor() {
      this.modeOpen = 0;
      this.modeSave = 1;
      this.returnOK = 0;
      this.returnCancel = 1;
      this.returnReplace = 2;
    }
    init(parent, title, mode) {
      assert(parent?.browsingContext, 'file picker must receive a Zotero window with BrowsingContext');
      pickerUses.push({ parent, title, mode });
    }
    appendFilter() {}
    async show() {
      const selected = picks.shift() || { result: this.returnCancel };
      this.file = selected.file || '';
      return selected.result;
    }
  }
  const zotero = {
    DataDirectory: { dir: '/zotero-test' },
    Libraries: { userLibraryID: 1 },
    getMainWindow: () => mainWindow,
    log() {},
    logError(error) { errors.push(String(error)); }
  };
  const hooks = { menus: [], observers: [] };
  if (nativeHooks) {
    zotero.Notifier = {
      registerObserver(observer) { hooks.observers.push(observer); return 1; },
      unregisterObserver() {}
    };
    zotero.MenuManager = {
      registerMenu(menu) { hooks.menus.push(menu); return menu.menuID; },
      unregisterMenu() {}
    };
  }
  const context = vm.createContext({
    Zotero: zotero,
    Services: { wm: { getEnumerator: () => ({ hasMoreElements: () => false }), addListener() {}, removeListener() {} } },
    PathUtils: { join: (...parts) => parts.join('/') },
    IOUtils: {
      exists: async () => true,
      readUTF8: async (file) => file === '/import.json' ? importContent : read,
      writeUTF8: async (file, value) => {
        if (writeError) throw writeError;
        writes.push({ file, value });
      }
    },
    ChromeUtils: { importESModule: () => ({ FilePicker }) },
    Components: { classes: {}, interfaces: {}, utils: {} },
    console,
    setTimeout,
    clearTimeout
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'zotero/chrome/content/scripts/index.js'), 'utf8'), context);
  return { host: zotero.ResearchFlow, zotero, writes, errors, pickerUses, mainWindow, hooks };
}

async function testHostPersistence() {
  const failed = createHost({ read: '{"revision":1,"manuscripts":[{"id":"old"}]}', writeError: new Error('disk full') });
  await failed.host.loadDatabase();
  await assert.rejects(failed.host.saveDatabase({ revision: 2, manuscripts: [{ id: 'new' }] }), /disk full/);
  assert.equal(failed.host._cachedData.manuscripts[0].id, 'old', 'failed write must not replace the in-memory snapshot');
  assert.equal(failed.writes.length, 0);

  const corrupt = createHost({ read: '{broken json' });
  await assert.rejects(corrupt.host.loadDatabase(), error => error.name === 'SyntaxError');
  assert.equal(corrupt.writes.length, 0, 'corrupt user data must not be overwritten');

  const healthy = createHost({ read: '{"revision":1}' });
  await healthy.host.loadDatabase();
  const saved = await healthy.host.saveDatabase({ revision: 2, manuscripts: [{ id: 'new' }] });
  assert.equal(saved.manuscripts[0].id, 'new');
  assert.equal(healthy.writes.length, 1);
  assert.equal(JSON.parse(healthy.writes[0].value).revision, 2);
  await healthy.host.updateUiState({ draft: { title: 'A paper' } });
  assert.equal((await healthy.host.loadUiState()).draft.title, 'A paper');
  assert(healthy.writes[1].file.endsWith('researchflow-ui-state.json'));
}

async function testFileActions() {
  const fixture = createHost({
    read: '{"revision":1,"manuscripts":[]}',
    importContent: '{"schemaVersion":7,"manuscripts":[{"id":"imported"}]}',
    picks: [
      { result: 0, file: '/export.json' },
      { result: 0, file: '/import.json' },
      { result: 0, file: '/diagnostics.json' },
      { result: 1 }
    ]
  });
  await fixture.host.loadDatabase();
  assert.equal((await fixture.host.exportDatabaseFile()).success, true);
  const imported = await fixture.host.importDatabaseFile('merge');
  assert.equal(imported.success, true);
  assert.equal(imported.data.manuscripts[0].id, 'imported');
  assert.equal((await fixture.host.exportDiagnosticsFile({ test: true })).success, true);
  assert.equal((await fixture.host.exportDatabaseFile()).cancelled, true);
  assert.equal(fixture.pickerUses.length, 4);
  assert(fixture.pickerUses.every(use => use.parent === fixture.mainWindow));
  assert(fixture.writes.some(write => write.file === '/zotero-test/researchflow-pre-import-backup.json'));
  assert(fixture.writes.some(write => write.file === '/export.json'));
  assert(fixture.writes.some(write => write.file === '/diagnostics.json'));

  const invalid = createHost({ read: '{"manuscripts":[]}', importContent: '{"unrelated":true}', picks: [{ result: 0, file: '/import.json' }] });
  await invalid.host.loadDatabase();
  const rejected = await invalid.host.importDatabaseFile('overwrite');
  assert.equal(rejected.success, false);
  assert.match(rejected.error, /ResearchFlow/);
  assert.equal(invalid.writes.length, 0, 'invalid import must not overwrite the database');
}

async function testLiteratureActions() {
  const fixture = createHost({ read: '{"manuscripts":[]}' });
  await fixture.host.loadDatabase();
  const item = {
    id: 11, key: 'ITEM11', libraryID: 1,
    isRegularItem: () => true,
    getField: field => field === 'title' ? 'Test article' : '',
    getCreators: () => [],
    getAttachments: () => [],
    getNotes: () => [],
    getCollections: () => [],
    getTags: () => []
  };
  fixture.zotero.Items = { get: id => id === 11 ? item : null };
  const collection = {
    id: 3, key: 'COL3', name: 'Literature', parentID: null,
    getChildItems(asIDs) {
      assert.equal(asIDs, true, 'Zotero Collection.getChildItems defaults to Item objects');
      return [11];
    }
  };
  fixture.zotero.Collections = { getByLibrary: () => [collection] };
  const collections = fixture.host.getZoteroCollections();
  assert.equal(collections[0].itemKeys[0], 'ITEM11');
  let navigation;
  fixture.host.triggerResearchFlowOpen = (_window, options) => { navigation = options; };
  await fixture.host.createManuscriptFromCollection(collection);
  assert.equal(navigation.items[0].key, 'ITEM11');
  let toast;
  fixture.host.showToast = (...args) => { toast = args; };
  fixture.host.createManuscriptFromSelection();
  assert.equal(toast[0], '未选择文献');
}

async function testStartupHooks() {
  const fixture = createHost({ read: '{"manuscripts":[]}', nativeHooks: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.hooks.observers.length, 1, 'Zotero item changes must be observed at startup');
  assert.equal(fixture.hooks.menus.length, 2, 'item and reader menus must be registered at startup');
  assert.equal(fixture.host._menuManagerItem, 'researchflow-itemmenu-actions');
  const readerMenu = fixture.hooks.menus.find(menu => menu.menuID === 'researchflow-reader-context');
  assert.equal(readerMenu.target, 'reader/menubar/edit', 'reader menu must use a supported Zotero target');
  assert.equal(fixture.host._menuManagerReader, 'researchflow-reader-context');
  const readerWindow = { reader: { itemID: 42 } };
  let commandWindow;
  fixture.host.createRecordFromReader = window => { commandWindow = window; };
  readerMenu.menus[0].onCommand({ target: { ownerGlobal: readerWindow } });
  assert.equal(commandWindow, readerWindow, 'reader menu must forward its reader window');
}

Promise.resolve()
  .then(testZoteroUiApi)
  .then(testHostPersistence)
  .then(testFileActions)
  .then(testLiteratureActions)
  .then(testStartupHooks)
  .then(() => console.log('zotero runtime tests passed'))
  .catch(error => { console.error(error); process.exitCode = 1; });
