# ResearchFlow 9.1.0 — Zotero reliability and reading flow

## Highlights

- Zotero Preferences now hosts the working cloud settings panel. The unused sidebar save/sync card is removed; manual cloud sync is available after a provider has been saved.
- Zotero JSON import, backup recovery, database persistence, and chrome-page compatibility are repaired. The import file picker initializes against a Zotero window.
- Dashboard, manuscript Kanban, and submission detail views share linked records. A submission linked to a manuscript no longer appears unlinked solely because it has no project.
- Dashboard and Kanban cards open the corresponding submission directly. The Kanban now uses the linked submission's journal, focuses on stages that contain manuscripts, and lets users reveal empty stages when planning a move.
- Reading layouts reduce repeated status blocks in the dashboard and duplicate summaries in submission details. Typography and action targets are clearer; mobile summary metrics fit in one row and journal shortcuts scroll horizontally.
- The dashboard's active count is labeled as active submissions, matching the records counted by its filter.
- Journal submission shortcuts can be added, edited, and removed, with URL validation.

## Compatibility and data

The database format is unchanged. Existing browser-extension and Zotero local databases remain separate; use JSON export and import to transfer data. Credentials remain device-local and are excluded from database exports and cloud payloads.

## Verification

Node regression and syntax checks, browser interaction checks, and Zotero 10.0.3 isolated-profile startup and Preferences checks passed. Real account WebDAV/GitHub synchronization, PDF selection, and operating-system file-dialog clicks were not exercised with user data.

## Install

- Zotero: install `researchflow-zotero-9.1.0.xpi` from Zotero's add-on manager and restart Zotero.
- Chrome Companion: extract `researchflow-companion-9.1.0.zip`, then use Chrome's **Load unpacked** command to select the extracted folder.
