const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'background.js'), 'utf8');
let messageListener = null;
const saveOrder = [];
let currentDatabase = { revision: 3, submissions: [{ id: 'existing' }] };

const context = {
  console,
  Date,
  Promise,
  setTimeout,
  clearTimeout,
  importScripts() {},
  self: {
    RFJournalPortals: {
      buildSubmissionCapture() {
        return null;
      }
    }
  },
  storage: {
    async loadAll() {
      return currentDatabase;
    },
    async mergeDatabases(incoming, current) {
      return { ...current, ...incoming, merged: true };
    },
    async saveAll(database, options) {
      if (database.id === 'first') await new Promise(resolve => setTimeout(resolve, 20));
      saveOrder.push(database.id);
      currentDatabase = { ...database, revision: (database.revision || 0) + 1 };
      assert.equal(options.localOnly, true);
      return currentDatabase;
    },
    async syncDatabaseNow() {
      return { success: true };
    }
  },
  chrome: {
    action: {
      onClicked: { addListener() {} }
    },
    runtime: {
      openOptionsPage() {},
      getURL(value) {
        return `chrome-extension://test/${value}`;
      },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      }
    },
    tabs: {
      async query() {
        return [];
      },
      async update() {},
      async create() {}
    },
    windows: {
      async update() {}
    },
    storage: {
      local: {
        async set() {}
      }
    }
  }
};

vm.runInNewContext(source, context, { filename: 'background.js' });
assert.equal(typeof messageListener, 'function');

function sendDatabaseWrite(data, mergeOnConflict = false) {
  return new Promise((resolve, reject) => {
    const keepChannelOpen = messageListener(
      { action: 'SAVE_DATABASE', data, mergeOnConflict },
      {},
      response => response.success ? resolve(response.data) : reject(new Error(response.error))
    );
    assert.equal(keepChannelOpen, true);
  });
}

(async () => {
  const first = sendDatabaseWrite({ id: 'first', revision: 3 });
  const second = sendDatabaseWrite({ id: 'second', revision: 4 }, true);
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.deepEqual(saveOrder, ['first', 'second'], 'database writes must remain serialized');
  assert.equal(firstResult.revision, 4);
  await assert.rejects(sendDatabaseWrite({ id: 'stale', revision: 1 }), /changed in another page/);
  assert.equal(secondResult.merged, true, 'conflict-aware writes should merge with the latest database');
  assert.equal(messageListener({ action: 'UNKNOWN' }, {}, () => {}), false);
  let denied;
  messageListener({ action: 'SAVE_DATABASE', data: {} }, { url: 'https://www.nature.com/test' }, r => { denied = r; });
  assert.equal(denied.success, false, 'content scripts cannot read or replace the workspace database');
  assert.equal(messageListener(null, {}, () => {}), false);
  messageListener({ action: 'SAVE_DATABASE', data: null }, {}, r => { denied = r; });
  assert.equal(denied.success, false);
  console.log('background write queue tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
