# ResearchFlow Companion v7.0.0

## Overview

Version 7.0.0 adds user-triggered Google Scholar and mirror-site capture, strengthens duplicate and author handling, preserves academic capture metadata across database imports, and adds conflict-aware cloud writes and privacy-safe diagnostics.

## Breaking and permission changes

- The extension now requests `activeTab` and `scripting` so a toolbar click can inspect the current Scholar-compatible page.
- Scholar captures default to the `published` manuscript status because Scholar results represent publications. The status remains editable during review.
- Chrome must reload the unpacked extension before the new permissions and service worker behavior become active.
- No database schema migration is required. Existing v6 databases remain readable.

## Added

- Structural detection for official Google Scholar result pages and compatible mirror sites without a fixed mirror-domain allowlist.
- Capture of up to eight results with an explicit result chooser.
- Reviewable title, publication, author list, first author, abstract, DOI, article URL, PDF URL, source host, and confidence metadata.
- DOI, normalized-URL, and normalized-title duplicate protection.
- Privacy-safe diagnostic export containing runtime, version, record counts, route validity, and capture settings without credentials or manuscript content.
- Regression coverage for mirror detection, empty official Scholar pages, ordinary-page collisions, toolbar routing, duplicate prevention, author parsing, WebDAV ETags, and GitHub retry behavior.

## Changed

- Scholar review uses a bounded non-blocking side card that keeps the manuscript workspace visible.
- Kanban titles are limited to three lines and columns use denser responsive spacing.
- Dashboard summary filters are native buttons with keyboard activation and `aria-pressed` state.
- Imported manuscripts preserve DOI, article URL, first-author metadata, and academic capture provenance.
- The toolbar keeps its normal direct-workspace behavior on non-Scholar pages.

## Fixed

- Official Scholar home or empty pages no longer create blank manuscript drafts.
- Ordinary pages with coincidentally similar markup require additional Scholar-specific evidence before capture.
- Comma-, semicolon-, conjunction-, and Chinese-delimited author lists are normalized before save.
- Repeated Scholar capture updates an existing matching manuscript only after user confirmation.
- Editing a manuscript can clear its project relationship.
- WebDAV writes use the fetched ETag and report a conflict instead of silently overwriting a changed remote database.
- GitHub SHA conflicts fetch, merge, retry once, and apply the rebased data to the local in-memory database.
- Modal focus is restored before hidden content becomes inert, avoiding the focused `aria-hidden` warning.
- Rapid setting changes reuse one timed status banner instead of stacking unreadable toast messages.

## Privacy

- Scholar inspection runs only after a toolbar click and uses temporary active-tab access.
- Captured information is staged locally for no more than 30 minutes and is written only after confirmation.
- Diagnostic export excludes credentials, tokens, passwords, repository names, WebDAV URLs, and manuscript metadata.
- Synchronization credentials remain device-local and are removed from exported or synchronized JSON.

## Verification

- All Node regression suites pass.
- All production JavaScript files pass syntax validation.
- Manifest JSON and repository whitespace checks pass.
- Installed Chrome verifies multiple-result selection, partial-width review, author normalization, published-state default, duplicate update, keyboard filters, and privacy-safe diagnostic export without console or page errors.
- The release source and the user-loaded runtime directory were compared for production-file equality.

## Upgrade

1. Export a JSON database backup.
2. Pull or replace the extension files.
3. Open `chrome://extensions`.
4. Reload ResearchFlow Companion and accept the new toolbar-triggered page permissions.
5. Confirm that the sidebar displays `v7.0.0 Companion`.

## Rollback

- A v7 database can be reopened by v6.1.0 because no schema version is changed.
- v6.1.0 will ignore Scholar provenance fields and does not provide Scholar capture, ETag conflict protection, or the diagnostic export.
- Export a JSON backup before rollback and avoid concurrent cloud writes from mixed extension versions.
