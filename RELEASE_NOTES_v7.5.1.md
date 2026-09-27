# ResearchFlow Companion v7.5.1

2026-09-19 · Local reliability and usability hardening

## Changes

- Route workspace initialization through the service-worker write queue and coalesce concurrent initialization.
- Decode GitHub database content as UTF-8 and encode branch query parameters.
- Propagate credential and device-ID storage failures; invalidate cached credentials after another page changes them.
- Bound background requests and preserve local save success when optional cloud scheduling fails.
- Preserve pending submission edits when switching records; warn before closing with unsaved changes and retain invalid editors for correction.
- Fix post-import/post-restore view refresh and preserve native backup tombstones, capture provenance and entity fields. Reject newer unsupported backup schemas.
- Prevent toolbar activation from unnecessarily reloading an existing workspace.
- Remove database writes from dashboard rendering and update notifications; only refresh the active view after autosave.
- Index manuscript lookups and batch submission card insertion.
- Add bilingual submission search without replacing the open editor.
- Restrict database messages to extension pages, reject unsafe editor URLs, escape journal portal content and safely render content-script toast text.
- Guard WebDAV first creation with If-None-Match and require ETag for updates; verify conflicts over an actual loopback HTTP fixture.
- Prevent narrow-screen settings cards from shrinking and keep backup controls above the mobile navigation.
- Honor reduced-motion preferences, including animation delays; show an actionable retry screen when startup fails.

## Verification

14 Node regression suites and all production JavaScript syntax checks passed in PowerShell 7. Real MV3 smoke passed in an isolated Chrome for Testing profile, including fast record switching, two-page reads, stale-write rejection, backup export/import/restore, toolbar focus, reload and service-worker stop/restart. A separate mocked-Chrome browser suite passed desktop/mobile, light/dark, share preview and startup-failure checks.

No authenticated GitHub/WebDAV server or long-duration multi-device stress test was used. Local packaging is not a public release or commercial certification. See HARDENING_REPORT_2026-09-19.md for scope and remaining release gates.
