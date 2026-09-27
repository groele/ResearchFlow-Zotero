const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  return {
    listeners: {},
    children: [],
    addEventListener(type, listener) { this.listeners[type] = listener; },
    replaceChildren() { this.children = []; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); }
  };
}

const ids = new Map();
const doc = {
  getElementById(id) {
    if (!ids.has(id)) ids.set(id, element());
    return ids.get(id);
  },
  createElementNS: () => element()
};
doc.getElementById('rf-import-mode').value = 'merge';
const calls = [];
const zotero = {
  version: '10.0.3',
  ResearchFlow: {
    getDataFilePath: () => '/test/researchflow-data.json',
    openResearchFlow: () => calls.push('open-tab'),
    openStandaloneWindow: (_options, _window, mode) => calls.push(`open-${mode}`),
    loadDatabase: async () => ({ schemaVersion: 7, manuscripts: [{ id: 1 }], submissions: [], projects: [], tasks: [] }),
    exportDatabaseFile: async () => ({ success: true, filePath: '/test/export.json' }),
    exportDiagnosticsFile: async report => {
      assert.equal(report.counts.manuscripts, 1);
      return { success: true, filePath: '/test/diagnostics.json' };
    },
    importDatabaseFile: async mode => {
      assert.equal(mode, 'merge');
      return { success: true, data: { manuscripts: [{ id: 2 }] } };
    },
    restoreBackupDatabase: async () => ({ manuscripts: [{ id: 3 }] })
  }
};
const window = { document: doc };
const context = vm.createContext({ window, Zotero: zotero, console });
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../zotero/chrome/content/scripts/preferences.js'), 'utf8'), context);
window.ResearchFlow_Preferences.init(window);

(async () => {
  const click = id => ids.get(id).listeners.click();
  assert.equal(ids.get('rf-data-path-label').textContent, '/test/researchflow-data.json');
  click('rf-btn-open-workspace');
  click('rf-btn-open-subwindow');
  click('rf-btn-open-window');
  assert.deepEqual(calls, ['open-tab', 'open-subwindow', 'open-window']);
  await click('rf-btn-export-db');
  assert.match(ids.get('rf-pref-status').textContent, /export\.json/);
  await click('rf-btn-export-diag');
  assert.match(ids.get('rf-pref-status').textContent, /diagnostics\.json/);
  await click('rf-btn-import-file');
  assert.match(ids.get('rf-import-status').textContent, /导入成功/);
  await click('rf-btn-restore-backup');
  assert.match(ids.get('rf-import-status').textContent, /备份恢复成功/);
  zotero.ResearchFlow.importDatabaseFile = async () => ({ success: false, error: 'invalid backup' });
  await click('rf-btn-import-file');
  assert.match(ids.get('rf-import-status').textContent, /invalid backup/);
  console.log('zotero preferences tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
