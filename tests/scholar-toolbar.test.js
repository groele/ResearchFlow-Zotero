const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'background.js'), 'utf8');

function createRuntime(captureResult) {
  let actionListener = null;
  const stored = {};
  const createdTabs = [];
  let executeCount = 0;

  const context = {
    console,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    importScripts() {},
    self: { RFJournalPortals: {} },
    storage: {},
    chrome: {
      action: {
        onClicked: {
          addListener(listener) {
            actionListener = listener;
          }
        }
      },
      runtime: {
        getURL(value) {
          return `chrome-extension://test/${value}`;
        },
        openOptionsPage() {},
        onMessage: { addListener() {} }
      },
      scripting: {
        async executeScript(details) {
          executeCount += 1;
          if (details.files) return [];
          return [{ result: captureResult }];
        }
      },
      storage: {
        local: {
          async set(next) {
            Object.assign(stored, next);
          }
        }
      },
      tabs: {
        async query() {
          return [];
        },
        async create(details) {
          createdTabs.push(details);
        },
        async update() {}
      },
      windows: { async update() {} }
    }
  };

  vm.runInNewContext(source, context, { filename: 'background.js' });
  return { getActionListener: () => actionListener, stored, createdTabs, getExecuteCount: () => executeCount };
}

async function flushAsyncWork() {
  await new Promise(resolve => setTimeout(resolve, 10));
}

(async () => {
  const mirrorResult = {
    title: 'Mirror-discovered paper',
    authors: 'A. Author, B. Author',
    publication: 'Example Journal, 2026',
    abstract: 'A captured abstract.',
    articleUrl: 'https://publisher.example/paper',
    sourcePageUrl: 'https://scholar-mirror.example/search?q=paper',
    sourceHost: 'scholar-mirror.example',
    sourceType: 'google-scholar-mirror',
    confidenceScore: 95,
    evidence: ['result-container', 'result-title']
  };
  const mirrorCapture = {
    isScholarPage: true,
    sourceHost: 'scholar-mirror.example',
    sourceType: 'google-scholar-mirror',
    sourcePageUrl: 'https://scholar-mirror.example/search?q=paper',
    confidenceScore: 95,
    results: [mirrorResult]
  };
  const detected = createRuntime(mirrorCapture);
  detected.getActionListener()({ id: 42, url: mirrorCapture.sourcePageUrl });
  await flushAsyncWork();

  assert.equal(detected.getExecuteCount(), 2, 'toolbar capture should inject and then execute the Scholar parser');
  assert.equal(
    detected.stored.researchflow_pending_academic_draft.title,
    mirrorResult.title,
    'captured metadata should be staged for review'
  );
  assert.match(
    detected.createdTabs[0].url,
    /pages\/options\.html\?mode=academic-capture$/,
    'a detected result should open the focused academic review route'
  );

  const ordinary = createRuntime({ isScholarPage: false, confidenceScore: 0 });
  ordinary.getActionListener()({ id: 7, url: 'https://example.com/' });
  await flushAsyncWork();
  assert.equal(
    ordinary.stored.researchflow_pending_academic_draft,
    undefined,
    'ordinary pages should not create academic drafts'
  );
  assert.equal(
    ordinary.createdTabs[0].url,
    'chrome-extension://test/pages/options.html',
    'ordinary pages should retain the normal toolbar behavior'
  );

  console.log('Scholar toolbar capture tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
