# ResearchFlow Companion v4.1.0

## Overview

Version 4.1.0 adds automatic recognition for mainstream journal submission systems without restoring a popup or side panel.

## Added

- Detects ScholarOne, Editorial Manager, eJournalPress, ACS, Wiley, Springer Nature, AIP Peer X-Press, MDPI, Frontiers, APS, and Science submission portals.
- Shows a compact in-page quick-entry card with per-site snooze and dismissal controls.
- Uses domain, title, metadata, labeled form fields, and workflow text to score recognition confidence.
- Captures manuscript title, journal, manuscript ID, workflow status, dates, authors, abstract, and keywords when available.
- Adds a first-author field to submission creation and editing, with a compact first-author line on dashboard pipeline cards.
- Provides independent switches for portal recognition and detailed information capture.
- Opens a dedicated human-review form; no captured data is saved until the user confirms.
- Confirmation creates a linked project, manuscript, and submission record with local capture provenance.
- Provides a Settings control for automatic recognition and resetting ignored websites.

## Improved

- New submissions accept a submission portal URL.
- A newly created submission becomes the selected record immediately.
- Clicking the page prompt navigates an existing ResearchFlow tab, or opens a new one, directly into the focused submission form.
- The visible workspace and editor version labels now match v4.1.0.

## Verification

- Seven Node regression suites.
- JavaScript syntax and ESLint `no-undef` checks.
- Browser validation of ScholarOne detection, quick-entry rendering, draft handoff, field prefilling, submission creation, immediate selection, and the Settings toggle.
- Zero browser console errors in the detected-portal and workspace flows.
