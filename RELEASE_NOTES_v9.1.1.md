# ResearchFlow 9.1.1 — Shared editing across all three views

- Dashboard, manuscript Kanban, and submission details now reflect edits to the same linked records, including status corrections in either direction, title, journal, first author, and timeline dates.
- Submission saves update the transaction copy that is actually persisted. Returning to the same submission refreshes its editor rather than retaining stale values.
- Delayed Zotero save notifications no longer replace newer changes or rebuild an editor while changes are pending.
- Dynamic buttons, selectors, and editors render as DOM nodes in Zotero's privileged pages. The shared template renderer preserves controls and removes executable content.
- The current submission is selected by transfer lineage, round, and date. Editing a manuscript updates its current attempt while preserving historical attempts.
- Legacy accepted/published splits are repaired when a published manuscript has a completed online event. Acceptance and online publication dates remain separate.
- Native schema 7 imports retain extra root and record fields. Existing journal, date, and nested manuscript aliases stay synchronized. No schema version change is required.
- The first automatic workflow migration preserves a snapshot in `researchflow_pre_workflow_sync_backup` in device-local UI storage. Personal export JSON files are excluded from Git.

## Verification

Node regression and syntax checks, real MV3 browser tests, and browser tests exercising Zotero's host API path with a mocked host passed. Shared edits from all three views, continuous typing, reload, legacy publication dates, and historical submission preservation were tested. An actual Zotero 10.0.3 isolated-profile probe exercised submission edits, Kanban status changes, dashboard dates, and disk persistence through the workspace DOM using a private copy of the supplied 9-manuscript/9-submission JSON. All status pairs matched. The supplied JSON also passed import round-trip and field/date preservation checks. Personal research data and the temporary QA package are not included in the release.

## Install

Install `researchflow-zotero-9.1.1.xpi` using Zotero's add-on manager, restart Zotero, and reopen the ResearchFlow tab. The existing local database is migrated automatically. For Chrome Companion, extract `researchflow-companion-9.1.1.zip` and select the extracted folder using **Load unpacked**.
