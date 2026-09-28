# ResearchFlow for Zotero 9.1.2 — Zotero-only distribution

- Removed the Chrome MV3 manifest, service worker, webpage content scripts, Scholar/portal detectors, Companion ZIP packages, and browser-extension tests.
- Removed browser-only automatic submission recognition from settings and retired its draft routes.
- Replaced the Chrome-named compatibility layer with the native RFPlatform UI API backed by Zotero UI state. Database writes and cloud operations use the Zotero host directly.
- Restricted XPI packaging to an explicit runtime script allowlist; package tests reject browser-extension entrypoints.
- Rewrote installation, usage, architecture, and development documentation for Zotero. Historical browser-only release notes were removed from the current tree.
- Retained shared editing across Dashboard, Manuscript Kanban, and Submissions, journal URL management, JSON import/export, backups, optional cloud sync, and Zotero literature integration. The JSON schema is unchanged.

## Install

Install researchflow-zotero-9.1.2.xpi through Zotero's add-on manager, restart Zotero, and reopen ResearchFlow. Existing database files remain compatible.

## Verification

All 15 Node regression suites, JavaScript syntax checks, XPI packaging checks, embedded settings/UI interactions, new submission creation, cross-view shared editing, and 468 share-card layout cases passed. An isolated Zotero 10.0.3 desktop probe verified migration, edits through all three views, and disk persistence with a private copy of the supplied 9-manuscript/9-submission JSON. The supplied file was not modified or included in the release.

UI automation uses simulated Zotero APIs and does not load a browser extension. Real cloud accounts and operating-system file-dialog clicks require separate account/UI verification.
