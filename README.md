# ResearchFlow Companion

**A local-first Chrome workspace for manuscript pipelines, journal submissions, peer review, and private metadata synchronization.**

[简体中文](README.zh-CN.md) · **English**

- Current version: **9.0.0**
- Browser requirement: **Google Chrome 116 or later**
- Runtime: **Manifest V3, vanilla JavaScript, no build step**

**New in 9.0:** Share Studio adds a visual browser for 13 card styles, three brand sizes, and standard/high/ultra PNG export. Long images have bounded bitmap sizes and an explicit adjustment notice. Design reset preserves hidden fields, and failed previews can be retried. Existing data and preferences remain compatible. See the [release notes](RELEASE_NOTES_v9.0.0.md).

> ResearchFlow helps researchers keep the operational history of a manuscript in one place: drafting, journal submission, review rounds, revision deadlines, acceptance, publication, and the events between them.

## Table of contents

- [Why ResearchFlow](#why-researchflow)
- [Core workflow](#core-workflow)
- [Feature overview](#feature-overview)
- [Status model](#status-model)
- [Journal submission recognition](#journal-submission-recognition)
- [Google Scholar and mirror capture](#google-scholar-and-mirror-capture)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Data storage and synchronization](#data-storage-and-synchronization)
- [Backup, import, and recovery](#backup-import-and-recovery)
- [Privacy and permissions](#privacy-and-permissions)
- [Removed modules and migration](#removed-modules-and-migration)
- [Project structure](#project-structure)
- [Development and verification](#development-and-verification)
- [Troubleshooting](#troubleshooting)
- [Current limitations](#current-limitations)

## Why ResearchFlow

Journal submission work is usually scattered across browser tabs, email, spreadsheets, notes, and multiple publisher portals. ResearchFlow focuses on the operational layer that is easy to lose:

- Which manuscript is currently active?
- Which journal and portal contain the current submission?
- Has the manuscript only been submitted, or has peer review actually started?
- When did the first decision arrive?
- What is the revision deadline?
- Which reviewer comments have been answered?
- How long did submission-to-acceptance take?
- Which project, manuscript, and submission record belong together?

ResearchFlow is intentionally **local-first**. It works without a cloud account and keeps the active database in Chrome local storage. WebDAV and GitHub synchronization are optional routes selected by the user.

## Core workflow

```text
Project
  └─ Manuscript
       ├─ Drafting and figure preparation
       ├─ Submission record
       │    ├─ Journal and portal
       │    ├─ Manuscript ID and dates
       │    ├─ Compliance checklist
       │    ├─ Review and revision events
       │    └─ Reviewer-response matrix
       └─ Acceptance and publication milestones
```

The active application has four workspaces:

| Workspace | Purpose |
| --- | --- |
| **Dashboard** | Overview metrics, manuscript pipeline cards, event timelines, waiting-time indicators, first-author display, and pending milestones. |
| **Manuscripts** | Kanban workflow for ideas, drafting, submission/review, acceptance, and publication. |
| **Submissions & Review** | Submission records, journal portals, workflow context, dates, checklists, timeline events, and reviewer responses. |
| **Settings** | Language, submission-site recognition, local/cloud routing, connection tests, JSON export, import, and recovery. |

Clicking the extension toolbar icon opens the full workspace directly. ResearchFlow does not register a popup or side panel.

## Feature overview

### Dashboard

- Displays total submissions, active review pipelines, and accepted/published pipelines.
- Filters pipeline cards by summary category.
- Shows compact or expanded timeline views.
- Displays the first author next to the submission date source.
- Calculates operational intervals when the required dates exist:
  - experiment completion to submission;
  - submission to today;
  - first review decision to today;
  - submission to acceptance;
  - acceptance to online publication.
- Lists pending and recent timeline milestones.

The dashboard may present a **timeline-derived phase** such as `After R1` or `Online`. This is a timeline summary, not necessarily the same field as the editable submission status. See [Status model](#status-model).

### Manuscript Kanban

- Creates and edits manuscript records.
- Tracks the manuscript from idea to publication.
- Groups records into:
  - Idea & Outline;
  - Drafting & Figures;
  - Submitted and Review;
  - Accepted & Published.
- Updates linked submission records when a manuscript lifecycle status is changed.
- Keeps manuscript title, target journal, authorship metadata, abstract draft, and timestamps.

### Submission tracker

- Creates a new submission and links it to an existing manuscript.
- Can create a linked project, manuscript, and submission from a reviewed portal capture.
- Records:
  - target journal;
  - journal portal;
  - external manuscript ID;
  - first author and author list;
  - submission status;
  - submission date;
  - first-decision date;
  - decision/publication date;
  - revision deadline;
  - abstract and keywords;
  - workflow notes and timeline events.
- Auto-saves editable submission fields. A separate save button is not required for routine edits.
- Avoids creating a second record when a reviewed portal capture matches an existing submission.
- Supports rejection and transfer to another journal while retaining the earlier submission history.

### Compliance and peer review

- Maintains submission checklist items.
- Tracks multiple review and revision events.
- Stores reviewer comments and response progress.
- Exports reviewer-response content as a reusable table.
- Keeps workflow context beside the active submission rather than in a separate module.

### Persistence and reliability

- Uses a local-first database with schema normalization.
- Serializes background writes to reduce lost updates from overlapping auto-save operations.
- Uses entity-aware merging for synchronized collections.
- Records deletion tombstones so an older remote snapshot cannot silently restore a deleted item.
- Removes synchronization credentials from exported and remotely synchronized database payloads.
- Validates imported JSON before replacing the active database.
- Keeps one device-local pre-import recovery snapshot.

## Status model

ResearchFlow uses three related but distinct concepts. Understanding the difference prevents apparent cross-screen inconsistencies.

### 1. Manuscript status

The manuscript-level lifecycle used by the Kanban board:

| Internal value | Meaning |
| --- | --- |
| `idea` | Initial research or manuscript idea |
| `outline` | Outline and planning |
| `data_collection` | Data collection |
| `figure_preparation` | Figure preparation |
| `drafting` | Manuscript drafting |
| `internal_review` | Internal review before submission |
| `submitted` | Manuscript submitted |
| `under_review` | Under journal or peer review |
| `revision` | Revision in progress |
| `accepted` | Accepted by the journal |
| `published` | Published |

### 2. Submission status

The state of a specific submission attempt:

| Internal value | Display label | Meaning |
| --- | --- | --- |
| `submitted` | Submitted | Submission completed, review not necessarily confirmed |
| `under_review` | Under Review | Editorial or peer-review processing |
| `revision` | Revision | Revision requested or being prepared |
| `accepted` | Accepted | The submission has been accepted |
| `published` | Published | The accepted paper has been published |
| `rejected` | Rejected | This submission attempt was rejected |

Legacy values such as `accept`, `in_review`, and `online` are normalized into the canonical lifecycle when a database is loaded.

### 3. Timeline-derived phase

The dashboard derives additional presentation states from milestone dates:

- `Under Review` when a submission date is available and no later milestone is recorded;
- `After R1` when a first-review event exists;
- `Accepted` when an acceptance event exists;
- `Online` when an online-publication event exists.

These labels describe the visible timeline position. They should not be interpreted as a replacement for the editable submission status.

## Journal submission recognition

ResearchFlow can recognize supported publisher submission systems and display a compact capture prompt inside the page.

### Supported platforms

| Platform | Recognized host |
| --- | --- |
| ScholarOne Manuscripts | `*.manuscriptcentral.com` |
| Editorial Manager | `*.editorialmanager.com` |
| eJournalPress | `*.ejournalpress.com` |
| ACS Paragon Plus | `publish.acs.org` |
| Wiley Submission | `submission.wiley.com` |
| Springer Nature Submissions | supported Nature submission hosts |
| AIP Peer X-Press | `*.peerx-press.org` |
| MDPI SuSy | `susy.mdpi.com` |
| Frontiers Review | `review.frontiersin.org` |
| APS Authors | `authors.aps.org` |
| Science Journals Submission | `submission.science.org` |

Recognition is based on the supported domain, page title, metadata, field labels, and visible workflow text. Publisher portals change over time, so every detected value must be reviewed by the user.

### Capture workflow

1. Open a supported journal submission site.
2. ResearchFlow recognizes the portal after the page becomes idle.
3. A compact prompt appears inside the current page.
4. Select **Capture information**.
5. ResearchFlow opens its workspace directly at a partial-width review form.
6. Verify or correct the detected fields.
7. Confirm creation.
8. ResearchFlow creates linked project, manuscript, and submission records, or opens an existing matching record.

Nothing is committed before the review form is confirmed.

### Fields that may be captured

- journal and portal;
- manuscript title;
- external manuscript or reference number;
- workflow status;
- submission date;
- revision due date;
- first author;
- author list;
- abstract;
- keywords.

The review form displays a confidence score and the number of detected fields. A high confidence score is not a guarantee of correctness.

### Fields deliberately excluded

The submission-site collector skips:

- password fields;
- email fields;
- file inputs and uploaded manuscripts;
- hidden form fields.

### Recognition controls

Settings contains two independent switches:

- **Automatic detection** — controls whether the in-page prompt is shown on supported sites.
- **Automatic information capture** — controls whether detailed manuscript fields are collected for review. When disabled, ResearchFlow carries only the basic portal context into manual entry.

An individual portal prompt can be ignored. Ignored websites can be restored from Settings.

## Google Scholar and mirror capture

ResearchFlow captures publication metadata from official Google Scholar result pages and structurally compatible mirror sites without maintaining a fixed mirror-domain list.

1. Open a Scholar search-results page and click the ResearchFlow toolbar icon.
2. ResearchFlow receives temporary access to that active tab and verifies Scholar result structures.
3. If several results are available, choose the intended paper from the compact selector.
4. Review the title, publication, authors, DOI, article URL, abstract, source host, and confidence.
5. Confirm the form to create or update the manuscript.

The detector requires an actual result container plus Scholar-specific metadata or search structure. Official Scholar home pages, empty pages, and ordinary pages with coincidentally similar markup are rejected.

Scholar publications default to `published`, but the status remains editable. Duplicate protection checks DOI, then a normalized article URL, then a normalized title. Author names are normalized into a list and the first author is stored explicitly. Capture provenance records the source and human review without writing anything before confirmation.

Inspection is triggered only by the toolbar click and uses temporary `activeTab` access rather than persistent access to arbitrary browsing history.

## Installation

ResearchFlow is currently distributed as an unpacked Chrome extension.

### Install from a local checkout

1. Download or clone this repository:

   ```powershell
   git clone https://github.com/groele/ResearchFlow-Extension.git
   cd ResearchFlow-Extension
   ```

2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the directory that directly contains `manifest.json`.
6. Pin **ResearchFlow Companion** to the Chrome toolbar.
7. Click the toolbar icon to open the full workspace.

### Update an unpacked installation

1. Export a JSON backup if the database is important.
2. Pull or replace the repository files.
3. Open `chrome://extensions`.
4. Select **Reload** on the ResearchFlow card.
5. Reopen the workspace and confirm the version shown in the navigation area.

Reloading extension files does not normally delete `chrome.storage.local`, but exporting a backup before a major upgrade is recommended.

### Important directory check

Chrome runs the directory selected during **Load unpacked**. Editing another copy of the repository will not update the installed extension. Use the extension card on `chrome://extensions` to verify the exact loaded path.

## Quick start

### Track a manuscript manually

1. Open **Manuscripts**.
2. Select **Add Manuscript**.
3. Enter the title and available metadata.
4. Choose the current manuscript stage.
5. Save the manuscript.

### Create a submission

1. Open **Submissions & Review**.
2. Select **Track New Submission**.
3. Choose an existing manuscript or create the required linked record.
4. Enter the journal, portal, first author, and known dates.
5. Confirm creation.
6. Continue editing in the submission workspace; supported fields auto-save.

### Record a review cycle

1. Open the relevant submission.
2. Add the first-decision or reviewer-comment event.
3. Enter the revision deadline when applicable.
4. Add reviewer comments and response progress.
5. Record the revision submission event.
6. Update the status when the journal communicates a decision.

### Mark acceptance and publication

- Use `Accepted` when the journal accepts the current submission.
- Use `Published` when the paper has been published.
- Add acceptance and online-publication dates to make dashboard durations meaningful.

## Data storage and synchronization

### Local-only mode

Local storage is the default route:

- no synchronization account is required;
- the database remains in Chrome local extension storage;
- the manual synchronization button is disabled because there is no remote destination.

Chrome profile deletion, extension removal with data cleanup, or browser profile corruption can remove local data. Use JSON export for durable backups.

### WebDAV

WebDAV synchronization reads and writes:

```text
<WebDAV base URL>/researchflow_db.json
```

Required settings:

- base URL using `http://` or `https://`;
- username;
- app password.

Example base URL:

```text
https://dav.example.com/researchflow
```

Use **Test WebDAV Connection** once to validate credentials and grant the required optional host permission. Do not enter a local filesystem path, a bare hostname, or a URL without a protocol.

### GitHub private repository

GitHub synchronization stores `researchflow_db.json` in the configured branch.

Required settings:

- personal access token;
- repository in `owner/repository` form;
- branch name, normally `main`.

Use a private repository and a token limited to the required repository contents. ResearchFlow uses the GitHub Contents API and preserves the remote file SHA when updating the database.

### Synchronization behavior

- Local edits are saved before cloud synchronization is scheduled.
- Missing remote data causes the current local database to be uploaded.
- Existing local and remote entity arrays are merged by identity and update metadata.
- Deletion tombstones are merged before live records are filtered.
- Device-local settings remain authoritative on that device.
- Invalid or incomplete provider configuration prevents synchronization and returns a bounded error.
- Cloud synchronization is not collaborative real-time editing. Avoid changing the same record simultaneously on multiple devices.

### Credentials

GitHub tokens and WebDAV credentials are kept in a separate device-local storage entry. They are excluded from:

- JSON exports;
- WebDAV database payloads;
- GitHub database payloads.

No browser extension storage should be treated as a dedicated operating-system secrets vault. Use limited-scope credentials and revoke them if a device is lost.

## Backup, import, and recovery

### Export

Open **Settings → Database Backup & Import → Export Database**.

The exported JSON contains the portable ResearchFlow database after secret fields and temporary GitHub metadata are removed.

### Import

1. Export the current database first.
2. Select **Import JSON**.
3. Choose a ResearchFlow JSON backup no larger than 25 MB.
4. Confirm the import.
5. Review the dashboard, manuscript count, and submission count.

The importer validates file size and database structure before replacement. Older supported schemas are normalized to the current schema.

### Restore the pre-import snapshot

Before a valid imported database replaces the active database, ResearchFlow keeps one rolling device-local snapshot. Use **Restore Pre-Import Backup** to return to that snapshot.

This recovery point:

- exists only on the current device;
- is replaced by a later valid import;
- is not a substitute for independently stored exports.

## Privacy and permissions

### Data handling summary

- Research data is local by default.
- Portal capture runs only on declared supported submission domains.
- Detected information is shown for human review before record creation.
- Passwords, email fields, and uploads are excluded from submission capture.
- WebDAV and GitHub synchronization are opt-in.
- Synchronization credentials are device-local and excluded from portable data.
- ResearchFlow does not include a generic AI assistant or send manuscript text to an AI provider.

### Manifest permissions

| Permission | Why it is used |
| --- | --- |
| `storage` | Store the local database, preferences, credentials, and recovery snapshot. |
| `tabs` | Focus or open the ResearchFlow workspace during reviewed portal capture. |
| `activeTab` | Temporarily inspect only the current tab after the toolbar icon is clicked. |
| `scripting` | Inject the packaged Scholar detector into the temporarily authorized tab. |
| `unlimitedStorage` | Allow a growing local research database beyond the small default extension quota. |
| Supported portal host permissions | Detect submission portals and show the capture prompt. |
| `https://api.github.com/*` | Optional GitHub database synchronization. |
| Optional `http://*/*` and `https://*/*` | Requested only for a user-configured WebDAV origin. |

Review `manifest.json` before installation if your organization has extension-data policies.

## Removed modules and migration

The following earlier experimental surfaces are intentionally not part of the active v7 product:

- Domain & Project Tree dashboard;
- Research Records dashboard;
- Evidence Locker;
- generic AI assistant;
- popup;
- side panel.

Historical Evidence Locker data is **not preserved for compatibility**. Schema 7 removes retired Evidence Locker fields, AI credentials, evidence-file routing, and obsolete file-sync configuration while normalizing an older database.

Active collections remain:

- projects;
- research records used internally for normalized database compatibility;
- manuscripts;
- submissions;
- tasks;
- deletion tombstones.

Do not use an older client to write to the same remote database after migrating to schema 7. Older clients do not understand the deletion-tombstone contract.

## Project structure

```text
ResearchFlow-Extension/
├─ manifest.json
├─ pages/
│  └─ options.html              # Full ResearchFlow workspace
├─ scripts/
│  ├─ background.js             # Toolbar entry, write queue, sync and capture handoff
│  ├─ content.js                # Supported submission-site prompt and field collection
│  ├─ journal-portals.js        # Portal rules, status inference and confidence scoring
│  ├─ scholar-mirrors.js        # Scholar/mirror fingerprints and metadata extraction
│  ├─ options.js                # Dashboard, Kanban, submissions, review and settings UI
│  ├─ core/
│  │  └─ research-core.js       # Shared research-domain helpers
│  ├─ storage.js                # Schema, local persistence, merge and cloud providers
│  ├─ ui-utils.js               # Shared UI and timeline utilities
│  └─ modules/                  # Focused UI/domain modules
├─ styles/
│  └─ options.css               # Main workspace design system
├─ assets/
│  └─ icons/
├─ data/
│  └─ preloaded_db.json         # Development/demo seed data
├─ tests/
│  ├─ *.test.js                 # Node regression suites
│  └─ browser-smoke.py          # Installed-Chrome smoke flow
├─ ARCHITECTURE.md
├─ RELEASE_NOTES_v6.0.0.md
├─ README.md
└─ README.zh-CN.md
```

## Development and verification

There is no package installation or bundling step. Production JavaScript is loaded directly by Chrome.

### Prerequisites

- Google Chrome 116 or later;
- Node.js for regression tests and syntax validation;
- Python and Playwright only when running the installed-browser smoke test.

### Run all Node regression suites

```powershell
$tests = Get-ChildItem tests -Filter *.test.js | Sort-Object Name
foreach ($test in $tests) {
  node $test.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

### Validate production JavaScript syntax

```powershell
$scripts = Get-ChildItem scripts -Recurse -Filter *.js | Sort-Object FullName
foreach ($script in $scripts) {
  node --check $script.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

### Test coverage areas

The current regression suites cover:

- background write serialization;
- interface localization;
- journal-portal detection and capture inference;
- workspace restoration and submission flows;
- research-domain helpers;
- runtime file contracts;
- script load order;
- storage and synchronization configuration;
- shared UI utilities.

Passing unit/regression tests does not replace installed-extension verification. For release work, load the exact checkout in Chrome and verify the dashboard, manuscript editor, submission editor, settings, capture handoff, and data persistence.

## Troubleshooting

### Clicking the icon does not open ResearchFlow

1. Open `chrome://extensions`.
2. Confirm ResearchFlow is enabled.
3. Select **Errors** and inspect service-worker errors.
4. Reload the extension.
5. Verify that Chrome loaded the directory containing the current `manifest.json`.

### Changes in the repository are not visible

Chrome may be loading a different copy of the extension. Check the loaded path on `chrome://extensions`, then reload the extension after changing files.

### `Invalid WebDAV URL`

Use a complete HTTP or HTTPS base URL:

```text
https://dav.example.com/researchflow
```

The following are invalid:

```text
D:\researchflow
dav.example.com/researchflow
ftp://dav.example.com/researchflow
```

Then run **Test WebDAV Connection** to grant the origin permission before manual synchronization.

### GitHub connection fails

- Enter the repository as `owner/repository`, not a browser URL.
- Confirm that the configured branch exists.
- Confirm that the token can read and write repository contents.
- Prefer a private repository.
- Revoke and replace a token that may have been exposed.

### The portal prompt does not appear

- Confirm the site is in the supported-platform table.
- Enable **Automatic detection** in Settings.
- Reset ignored websites if the domain was previously dismissed.
- Reload the portal page after reloading the extension.
- Publisher markup may have changed; use manual submission entry and report the affected URL pattern without sharing credentials or private manuscript content.

### Capture contains incomplete or incorrect information

Detection is heuristic. Review every field, especially:

- journal name;
- manuscript ID;
- workflow status;
- first author;
- dates.

Correct the values in the review form before confirming. A confidence percentage is an aid, not proof.

### A status label differs between screens

Check whether the screens are showing:

- manuscript status;
- a specific submission status; or
- a timeline-derived dashboard phase.

See [Status model](#status-model). If two screens claim to show the same status type but disagree, export a backup before editing and report the manuscript title plus the two affected views.

### Manual synchronization is disabled

This is expected in local-only mode. Select and fully configure WebDAV or GitHub before using manual synchronization.

### Imported data looks wrong

Use **Restore Pre-Import Backup** immediately, then inspect the imported JSON. Do not perform multiple imports before recovery because only one rolling pre-import snapshot is retained.

## Current limitations

- Chrome/Chromium is the supported browser target; Firefox and Safari are not supported.
- ResearchFlow is currently installed as an unpacked extension.
- Portal recognition depends on publisher DOM and wording that may change without notice.
- Capture is heuristic and always requires human verification.
- Cloud synchronization is not real-time collaboration.
- Concurrent edits to the same entity on several devices should be avoided.
- Credentials are stored locally by the extension, not in an operating-system secrets vault.
- Dashboard timeline phases and editable record statuses are related but distinct concepts.
- The repository does not use a build system or static type checker.

## Version and release notes

The installed version is defined in `manifest.json`. Major release details are documented in:

- [ResearchFlow Companion v9.0.0 release notes](RELEASE_NOTES_v9.0.0.md)
- [ResearchFlow Companion v6.1.0 release notes](RELEASE_NOTES_v6.1.0.md)
- [Architecture overview](ARCHITECTURE.md)

For bugs or feature requests, use the repository issue tracker and include:

- ResearchFlow version;
- Chrome version;
- the loaded extension path;
- affected workspace;
- reproducible steps;
- console error text with tokens, credentials, email addresses, and manuscript-sensitive information removed.
