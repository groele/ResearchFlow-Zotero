# ResearchFlow core architecture

ResearchFlow is a focused manuscript and submission workflow manager.

## Active research loop

`Manuscript → submission → review/revision → acceptance/publication`

The main workspace has four views:

- **Dashboard**: manuscript pipelines, event timing and alerts.
- **Manuscripts**: kanban workflow.
- **Submissions & Review**: submission tracking, checklists and reviewer responses.
- **Settings**: metadata synchronization and JSON backup/import.

Clicking the toolbar icon opens the full workspace directly. No popup or side panel is registered.

## Module boundaries

| Path | Responsibility |
| --- | --- |
| `scripts/options.js` | Dashboard, manuscript kanban, submissions, peer review, portals, settings, import/export and navigation. |
| `scripts/storage.js` | Local-first persistence, schema normalization, secret redaction, conflict merging and optional WebDAV/GitHub synchronization. |
| `scripts/background.js` | Toolbar entrypoint, serialized database writer, explicit synchronization and reviewed submission-capture handoff. |
| `scripts/content.js` | Submission-portal recognition and the compact capture prompt on supported journal systems. |

## Removed from the active experience

Evidence Locker, project-tree and record-library dashboard sections, generic AI assistant, popup, side panel, and related permissions no longer load in the extension.

## Compatibility and migration

Existing `projects`, `researchRecords`, `manuscripts`, `submissions`, and `tasks` remain normalized. Database schema version 7 removes historical Evidence Locker fields, AI credentials, evidence file-routing settings, and synchronization secrets from the portable database, and adds deletion tombstones so stale remote snapshots cannot restore deleted entities. GitHub tokens and WebDAV credentials remain device-local and are excluded from cloud payloads and JSON exports.

All workspace writes pass through one service-worker queue. Submission autosaves use entity-aware conflict merging, and the committed snapshot is returned to the caller so its in-memory revision stays current. JSON import validates the file size and schema before replacement, then creates one rolling device-local pre-import recovery snapshot.

Cloud downloads/uploads run outside the commit queue. Both local sync commits re-read and merge the latest snapshot inside that queue, preserving edits made during network waits. Page saves fail explicitly when the writer is unavailable; they do not fall back to uncoordinated writes. Whole-database saves require the current revision, while explicit import/restore replacements carry an expected revision. Storage errors propagate before publishing a committed snapshot. Cloud requests have a 20-second abort deadline; write retries remain provider-specific.

`styles/workspace.css` owns shared workspace components and appearance-aware refinements. Fonts resolve locally with explicit Chinese fallbacks. `tests/storage-reliability.test.js` covers edits during download/upload, storage failures and writer unavailability. `tests/workspace-browser-smoke.js` checks UI flows using mocked Chrome APIs; it does not certify live cloud accounts or extension service-worker lifecycle behavior.

## 7.5.1 runtime hardening

Workspace reads now use `LOAD_DATABASE` through the service-worker queue; one in-flight initialization promise coalesces simultaneous reads. Background request deadlines are centralized. Credential cache invalidation uses `chrome.storage.onChanged`; failed writes do not publish new cached credentials. GitHub download decodes UTF-8 before JSON parsing.

Dashboard rendering and database-update notifications no longer issue database saves. Autosave captures an immutable form-value snapshot before waiting in its queue, so replacing the editor does not discard a queued edit. Native schema-7 backup imports preserve entity fields and deletion tombstones while retaining device settings. Bilingual submission search filters cards without replacing the active editor.

Use `pwsh -NoProfile -File tests/verify.ps1` for regression and syntax checks. Add `-Browser` with Playwright and its Chromium available for isolated real-MV3 testing. `tests/extension-browser-smoke.js` additionally checks service-worker restart, two-page access, stale revision rejection and native backup round trips. See `HARDENING_REPORT_2026-09-19.md` for remaining release gates.

WebDAV uploads use `If-None-Match: *` for creation and `If-Match` for known versions. Existing remote files without an ETag are rejected rather than overwritten without a precondition. `tests/cloud-transport.test.js` exercises these conditions over a loopback HTTP server; this is not an authenticated external-provider certification.
