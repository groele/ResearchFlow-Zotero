const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'chrome/content/scripts/index.js'), 'utf8');

const getPrefCode = source.slice(source.indexOf('    getPref(key, defaultValue) {'), source.indexOf('    setPref(key, value) {'));
const updateItemMenuCode = source.slice(source.indexOf('    updateItemContextMenu() {'), source.indexOf('    async searchLibrary(query, limit = 15) {'));

function createTestRuntime(prefs = {}) {
  const registeredMenus = [];
  const unregisteredMenus = [];
  const removedElements = [];

  const mockElements = new Map([
    ['researchflow-itemmenu-separator', { remove: () => removedElements.push('researchflow-itemmenu-separator') }],
    ['researchflow-itemmenu-create', { remove: () => removedElements.push('researchflow-itemmenu-create') }],
    ['researchflow-itemmenu-link', { remove: () => removedElements.push('researchflow-itemmenu-link') }],
    ['researchflow-collectionmenu-separator', { remove: () => removedElements.push('researchflow-collectionmenu-separator') }],
    ['researchflow-collectionmenu-create', { remove: () => removedElements.push('researchflow-collectionmenu-create') }]
  ]);

  const mockDoc = {
    getElementById(id) {
      return mockElements.get(id) || null;
    }
  };

  const mockWin = {
    document: mockDoc
  };

  const context = vm.createContext({
    PREF_PREFIX: 'extensions.researchflow.',
    ADDON_ID: 'researchflow@groele.org',
    CHROME_ROOT: 'chrome://researchflow/content/',
    Zotero: {
      Prefs: {
        get(key) {
          return prefs[key];
        }
      },
      MenuManager: {
        registerMenu(def) {
          registeredMenus.push(def);
          return 'menu-id-123';
        },
        unregisterMenu(id) {
          unregisteredMenus.push(id);
        }
      },
      logError() {}
    },
    Services: {
      wm: {
        getEnumerator() {
          const list = [mockWin];
          let index = 0;
          return {
            hasMoreElements: () => index < list.length,
            getNext: () => list[index++]
          };
        }
      }
    }
  });

  const script = `({
    _menuManagerItem: null,
    _menuManagerReader: null,
    ${getPrefCode}
    ${updateItemMenuCode}
  })`;

  const runtime = vm.runInContext(script, context);
  return { runtime, registeredMenus, unregisteredMenus, removedElements, mockDoc };
}

test('by default (showContextMenu = false), context menu is not registered and stale DOM items are purged', () => {
  const { runtime, registeredMenus, removedElements } = createTestRuntime({});
  runtime.updateItemContextMenu();
  assert.equal(registeredMenus.length, 0);
  assert.equal(runtime._menuManagerItem, null);
  assert.deepEqual(removedElements, [
    'researchflow-itemmenu-separator',
    'researchflow-itemmenu-create',
    'researchflow-itemmenu-link',
    'researchflow-collectionmenu-separator',
    'researchflow-collectionmenu-create'
  ]);
});

test('when showContextMenu = true, item context menu is registered via MenuManager', () => {
  const { runtime, registeredMenus } = createTestRuntime({
    'extensions.researchflow.showContextMenu': true
  });
  runtime.updateItemContextMenu();
  assert.equal(registeredMenus.length, 1);
  assert.equal(registeredMenus[0].target, 'main/library/item');
  assert.equal(runtime._menuManagerItem, 'menu-id-123');
});

test('toggling showContextMenu from true to false unregisters the menu item', () => {
  const { runtime, registeredMenus, unregisteredMenus } = createTestRuntime({
    'extensions.researchflow.showContextMenu': true
  });
  runtime.updateItemContextMenu();
  assert.equal(registeredMenus.length, 1);
  assert.equal(runtime._menuManagerItem, 'menu-id-123');

  // Change to false
  runtime.getPref = () => false;
  runtime.updateItemContextMenu();
  assert.equal(runtime._menuManagerItem, null);
  assert.deepEqual(unregisteredMenus, ['menu-id-123']);
});
