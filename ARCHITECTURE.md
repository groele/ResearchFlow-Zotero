# Zotero architecture

## Runtime

| Component | Responsibility |
| --- | --- |
| zotero/bootstrap.js | Add-on startup, shutdown, Gecko resource registration |
| zotero/chrome/content/scripts/index.js | Native tabs, menus, reader integration, serialized database writes, file pickers, notifications |
| zotero/chrome/content/scripts/preferences.js | Zotero preference pane, import/export and cloud settings |
| scripts/zotero-window-polyfill.js | Resolve host window arguments before workspace scripts load |
| scripts/zotero-ui-api.js | RFPlatform API for local UI state and workspace messages |
| scripts/zotero-bridge.js | Access Zotero items, collections, notes, PDF links, and host operations |
| scripts/storage.js | Schema normalization, local commits, credentials, merge rules, WebDAV/GitHub transport |
| scripts/core/research-core.js | Linked-record and current-attempt selection rules |
| scripts/options.js | Dashboard, Kanban, submissions, portals, and embedded settings |
| scripts/ui-utils.js | Safe DOM templates and UI helpers |
| scripts/share-card.js | Local canvas card layout and drawing |

## Shared editing

All views use one database snapshot. Submissions refer to manuscriptId; transfer attempts refer to previousSubmissionId. Current-attempt selection follows transfer lineage, round, and date. Saves use the transaction copy and adopt the native host's committed revision. Host notifications refresh views while protecting pending edits from stale echoes.

Manuscript edits update current submission fields and linked title snapshots. Current submission edits update the manuscript. Historical submission status and journal are preserved. Event editing preserves acceptance and online publication dates separately. The first workflow migration retains a local backup.

## Packaging and tests

scripts/build-zotero.mjs builds the native add-on and generates chrome/content/index.html from pages/options.html. A runtime allowlist excludes build helpers and non-runtime modules. scripts/build-zotero.ps1 creates the XPI. The only product manifest is zotero/manifest.json, and zotero/update.json points to an XPI release.

Node suites verify shared data, transport, native adapters, file picker handling, preferences, runtime contracts, and package contents. Browser-only Playwright smoke tests and their HTTP/mock-host harness are intentionally excluded from the repository. Native desktop verification should use an isolated Zotero profile and data directory. Gecko chrome:// resources are part of Zotero's implementation.
