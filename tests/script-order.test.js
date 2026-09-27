const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readWorkspaceFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertUtilityLoadedBefore(pagePath, scriptPath) {
  const page = readWorkspaceFile(pagePath);
  const script = readWorkspaceFile(scriptPath);
  const utilityTag = '../scripts/ui-utils.js';
  const pageScriptTag = `../${scriptPath.replace(/\\/g, '/')}`;

  if (!script.includes('window.RFUI')) {
    return;
  }

  const utilityIndex = page.indexOf(utilityTag);
  const scriptIndex = page.indexOf(pageScriptTag);

  assert.notStrictEqual(scriptIndex, -1, `${pagePath} must load ${scriptPath}`);
  assert.notStrictEqual(
    utilityIndex,
    -1,
    `${pagePath} must load scripts/ui-utils.js before ${scriptPath}`
  );
  assert(
    utilityIndex < scriptIndex,
    `${pagePath} loads scripts/ui-utils.js after ${scriptPath}`
  );
}

assertUtilityLoadedBefore('pages/options.html', 'scripts/options.js');

console.log('script-order tests passed');
