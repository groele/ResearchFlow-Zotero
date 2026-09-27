const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const optionsJs = read('scripts/options.js');

assert(optionsJs.includes("dashboardNav: 'Dashboard Overview'"), 'main workspace should retain English localization');
assert(optionsJs.includes("dashboardNav: '仪表盘总览'"), 'main workspace should retain Chinese localization');
assert(optionsJs.includes("manuscriptsNav: '手稿看板'"), 'manuscript workspace should retain Chinese localization');
assert(optionsJs.includes("submissionsNav: '投稿与审稿'"), 'submission workspace should retain Chinese localization');
assert(optionsJs.includes("submissionAssistTitle: '投稿网站智能识别'"), 'submission portal recognition should retain Chinese localization');
assert(optionsJs.includes("submissionAssistEnabled: '已启用'"), 'submission portal recognition status should retain Chinese localization');
assert(optionsJs.includes("confirmCreateProject: '确认并新建项目'"), 'capture review action should retain Chinese localization');
assert(optionsJs.includes("firstAuthorLabel: '第一作者'"), 'first-author information should retain Chinese localization');
assert(optionsJs.includes("submissionAssistCaptureToggle: '自动捕获投稿信息'"), 'detailed capture toggle should retain Chinese localization');
assert(!/Evidence Locker|证据库|AI Copilot|AI 助手/.test(optionsJs), 'removed modules should not remain in localization');

console.log('main workspace localization tests passed');
