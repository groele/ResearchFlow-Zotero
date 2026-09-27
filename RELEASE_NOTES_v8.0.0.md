# ResearchFlow Companion v8.0.0

2026-09-19 · Share Studio redesign, submission search, and release hardening

## Changes

- Redesign Share Studio with a measured, responsive preview that wraps long English, Chinese, and mixed-script text before painting it to PNG.
- Add four share-card appearances: Paper, Ink, Blueprint, and Minimal. Each style keeps the same privacy controls, timeline data, and export behavior.
- Make share-card height content-aware, preserve readable event spacing, cap very long timelines safely, and keep hidden fields out of both the image and generated filename.
- Rework the submission search surface with an integrated search field, clear action, status filter, result count, empty state, keyboard shortcuts, normalized accents and full-width punctuation, and composition-safe input handling.
- Keep the active submission editor stable while filtering; search indexes title, journal, author, manuscript ID, DOI, and status without re-rendering the editor.
- Fix narrow share controls so labels wrap inside their cards and remove the cramped overflow badge treatment shown in the previous two-column layout.
- Retain the v7.5.1 local-first reliability hardening, backup schema guard, WebDAV conditional-write protection, and browser smoke coverage.

## Compatibility

- The extension remains Manifest V3 and requires Chrome 116 or later.
- Existing local data and schema 7 backups remain supported. Backups from a newer schema are still rejected with an actionable message.
- WebDAV updates continue to require an ETag; servers that do not return one must be upgraded or used in a read-only workflow.
- Share preferences accept the new `blueprint` and `minimal` appearance values while older saved `paper` and `ink` preferences remain valid.

## Verification

PowerShell 7 verification passed all Node regression suites, production syntax checks, real MV3 extension smoke tests, and 48 Share Studio layout cases across English and Chinese text, four appearances, 0–100 milestones, privacy toggles, real PNG download, zoom, mobile layout, and blob-URL cleanup.

The published package is assembled from the reviewed runtime files. No authenticated GitHub, WebDAV, or multi-device stress test was used, so those environments remain outside this release's local verification boundary.
