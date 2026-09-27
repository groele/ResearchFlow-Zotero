const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bridgePath = path.resolve(__dirname, '../scripts/zotero-bridge.js');
const bridgeCode = fs.readFileSync(bridgePath, 'utf8');

// 1. Test in browser mock environment
const mockWindow = {
  location: { protocol: 'chrome:', host: 'researchflow', search: '' },
  documentElement: { classList: { add() {} } },
  document: {
    documentElement: { classList: { add() {} } },
    body: { classList: { add() {} } },
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.nav-item[data-view="view-manuscripts"]') return { click: () => { mockWindow._navigationClicks = (mockWindow._navigationClicks || 0) + 1; } };
      return null;
    },
    readyState: 'complete'
  },
  addEventListener(type, listener) {
    if (type === 'researchflow-workspace-ready') this._readyListener = listener;
  },
  postMessage() {},
  parent: null,
  opener: null,
  Zotero: {
    ResearchFlow: {
      getCurrentActiveItem() {
        return {
          key: 'ITEM123',
          title: 'Test Paper for Zotero',
          publication: 'Nature',
          authors: 'Alice Smith, Bob Jones',
          doi: '10.1038/s41586-024-00000',
          url: 'https://nature.com/articles/s41586-024-00000',
          abstract: 'An abstract about test results.'
        };
      },
      serializeLiteratureItem(it) {
        return it;
      },
      openPdfAttachment() {},
      async syncManuscriptToChildNote() {
        return { id: 999 };
      },
      getZoteroCollections() {
        return [{ id: 1, name: 'Machine Learning', key: 'ML1' }];
      },
      async searchLibrary(query) {
        if (query.includes('Nature')) {
          return [{ key: 'ITEM123', title: 'Nature Paper' }];
        }
        return [];
      },
      showToast(title, message, type) {
        mockWindow._lastToast = { title, message, type };
      },
      getLiteratureAnnotations() {
        return [{ key: 'ANNO1', text: 'Important finding', page: 2 }];
      },
      getLiteratureNotes() {
        return [{ key: 'NOTE1', title: 'Summary note', snippet: 'A great summary' }];
      },
      getLiteratureReadingAssets() {
        return {
          annotations: [{ key: 'ANNO1', text: 'Important finding', page: 2 }],
          notes: [{ key: 'NOTE1', title: 'Summary note', snippet: 'A great summary' }],
          collections: [{ name: 'AI', path: 'My Lib / AI' }],
          tags: ['AI', 'Survey']
        };
      },
      async syncStatusTagToItem(item, status) {
        mockWindow._lastStatusTag = status;
        return true;
      },
      async addItemToPipelineCollection() {
        mockWindow._pipelineAdded = true;
        return { id: 77 };
      },
      async exportDatabaseFile() {
        mockWindow._dbExported = true;
        return { success: true, filePath: '/tmp/rf-export.json' };
      },
      async importDatabaseFile(mode) {
        mockWindow._dbImportedMode = mode;
        return { success: true, data: { manuscripts: [] } };
      },
      async exportDiagnosticsFile(report) {
        mockWindow._diagnosticsReport = report;
        return { success: true, filePath: '/tmp/rf-diagnostics.json' };
      },
      async restoreBackupDatabase() {
        mockWindow._backupRestored = true;
        return { manuscripts: [] };
      }
    },
    Items: {
      getByLibraryAndKey() {
        return { id: 100, key: 'ITEM123' };
      }
    },
    Libraries: {
      userLibraryID: 1
    }
  }
};
mockWindow.parent = mockWindow;

const context = vm.createContext({
  window: mockWindow,
  document: mockWindow.document,
  console,
  setTimeout,
  clearTimeout,
  URLSearchParams,
  Map,
  Promise
});

vm.runInContext(bridgeCode, context);
const ZoteroBridge = context.ZoteroBridge;

assert(ZoteroBridge, 'ZoteroBridge must be defined on global context');
assert.equal(ZoteroBridge.isZotero, true, 'ZoteroBridge must detect Zotero environment');
assert.equal(typeof ZoteroBridge.getActiveItem, 'function', 'getActiveItem must be a function');
assert.equal(typeof ZoteroBridge.openPdf, 'function', 'openPdf must be a function');
assert.equal(typeof ZoteroBridge.syncNote, 'function', 'syncNote must be a function');
assert.equal(typeof ZoteroBridge.getCollections, 'function', 'getCollections must be a function');
assert.equal(typeof ZoteroBridge.selectItemInZotero, 'function', 'selectItemInZotero must be a function');
assert.equal(typeof ZoteroBridge.getAnnotations, 'function', 'getAnnotations must be a function');
assert.equal(typeof ZoteroBridge.getReadingAssets, 'function', 'getReadingAssets must be a function');
assert.equal(typeof ZoteroBridge.getNotes, 'function', 'getNotes must be a function');
assert.equal(typeof ZoteroBridge.syncStatusTag, 'function', 'syncStatusTag must be a function');
assert.equal(typeof ZoteroBridge.addToPipelineCollection, 'function', 'addToPipelineCollection must be a function');
assert.equal(typeof ZoteroBridge.copyText, 'function', 'copyText must be a function');
assert.equal(typeof ZoteroBridge.exportDatabase, 'function', 'exportDatabase must be a function');
assert.equal(typeof ZoteroBridge.importDatabase, 'function', 'importDatabase must be a function');
assert.equal(typeof ZoteroBridge.exportDiagnostics, 'function', 'exportDiagnostics must be a function');
assert.equal(typeof ZoteroBridge.restoreBackup, 'function', 'restoreBackup must be a function');
assert.equal(typeof ZoteroBridge.openExternal, 'function', 'openExternal must be a function');
ZoteroBridge.handleHostNavigation({ view: 'view-manuscripts' });
assert.equal(mockWindow._navigationClicks, undefined, 'navigation waits for workspace initialization');
mockWindow._researchflowWorkspaceReady = true;
mockWindow._readyListener();
assert.equal(mockWindow._navigationClicks, 1, 'queued navigation runs once when workspace is ready');

// Test getActiveItem directly with mock Zotero
ZoteroBridge.getActiveItem().then((item) => {
  assert(item, 'Item should be returned from mock Zotero');
  assert.equal(item.title, 'Test Paper for Zotero');
  assert.equal(item.doi, '10.1038/s41586-024-00000');

  return ZoteroBridge.syncNote('ITEM123');
}).then((syncOk) => {
  assert.equal(syncOk, true, 'syncNote should succeed in mock Zotero environment');
  return ZoteroBridge.getCollections();
}).then((cols) => {
  assert.equal(cols.length, 1);
  assert.equal(cols[0].name, 'Machine Learning');
  return ZoteroBridge.searchLibrary('Nature');
}).then((results) => {
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Nature Paper');
  ZoteroBridge.showNativeToast('测试', '通知消息', 'success');
  assert.equal(mockWindow._lastToast.title, '测试');
  assert.equal(mockWindow._lastToast.message, '通知消息');

  return ZoteroBridge.getAnnotations('ITEM123');
}).then((annos) => {
  assert.equal(annos.length, 1);
  assert.equal(annos[0].key, 'ANNO1');
  return ZoteroBridge.getReadingAssets('ITEM123');
}).then((assets) => {
  assert.equal(assets.annotations.length, 1);
  assert.equal(assets.notes.length, 1);
  assert.equal(assets.notes[0].key, 'NOTE1');
  assert.equal(assets.collections[0].path, 'My Lib / AI');
  assert.equal(assets.tags.length, 2);
  return ZoteroBridge.getNotes('ITEM123');
}).then((notes) => {
  assert.equal(notes.length, 1);
  assert.equal(notes[0].key, 'NOTE1');
  return ZoteroBridge.syncStatusTag('ITEM123', 'submitted');
}).then((tagOk) => {
  assert.equal(tagOk, true);
  assert.equal(mockWindow._lastStatusTag, 'submitted');
  return ZoteroBridge.addToPipelineCollection('ITEM123');
}).then((colOk) => {
  assert.equal(colOk, true);
  assert.equal(mockWindow._pipelineAdded, true);
  return ZoteroBridge.exportDatabase();
}).then((exp) => {
  assert.equal(exp.success, true);
  assert.equal(mockWindow._dbExported, true);
  return ZoteroBridge.importDatabase('merge');
}).then((imp) => {
  assert.equal(imp.success, true);
  assert.equal(mockWindow._dbImportedMode, 'merge');
  return ZoteroBridge.exportDiagnostics({ test: true });
}).then((diag) => {
  assert.equal(diag.success, true);
  assert.equal(mockWindow._diagnosticsReport.test, true);
  return ZoteroBridge.restoreBackup();
}).then((rest) => {
  assert.equal(rest.success, true);
  assert.equal(mockWindow._backupRestored, true);
  console.log('zotero bridge tests passed');
}).catch((err) => {
  console.error('zotero bridge test error:', err);
  process.exit(1);
});
