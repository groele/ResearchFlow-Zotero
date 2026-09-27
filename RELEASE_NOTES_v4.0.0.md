# ResearchFlow Companion v4.0.0

## Overview

Version 4.0.0 establishes the verified, build-free Chrome MV3 workspace as the primary ResearchFlow application. It replaces the previous WXT/TypeScript application on the `main` branch with the local-first runtime validated in Chrome.

The main workspace keeps Dashboard, Manuscripts, Submissions & Review, journal portals, peer-review response tools, and Settings. Clicking the toolbar icon opens the full application directly.

## Breaking changes

- Replaced the WXT/React application layout with a build-free Chrome MV3 runtime.
- Removed the popup and Chrome side-panel entry points.
- Removed Domain & Project Tree, the Research Records dashboard, Evidence Locker, and the generic AI assistant.
- Removed AI drafting, AI guideline parsing, AI credentials, evidence-file routing, and historical Evidence Locker compatibility.
- The toolbar icon now opens the full options workspace instead of a popup or side panel.

## Data and configuration impact

- Database schema version 5 keeps normalized projects, research records, manuscripts, submissions, and tasks.
- Loading or importing data permanently discards `evidence`, `projectEvidenceLinks`, `recordEvidenceLinks`, `settings.ai`, and `settings.syncProviders.files`.
- Existing WXT build scripts, TypeScript sources, package metadata, and generated bundles are no longer part of the active application.
- Chrome 116 or newer is required.

## Migration

1. Export any data that must be retained before upgrading.
2. Do not rely on historical Evidence Locker data; v4.0.0 intentionally removes it.
3. Remove or disable the previous unpacked ResearchFlow installation.
4. Load the v4.0.0 repository root through `chrome://extensions`.
5. Close previously opened ResearchFlow tabs, then click the toolbar icon to open the new main workspace.

No dependency installation or build command is required.

## Verification

- Six Node regression suites covering localization, restored workspace behavior, storage, script ordering, UI helpers, and removed-module contracts.
- JavaScript syntax checks for every active runtime script.
- ESLint `no-undef` validation, including regression coverage for `metaTitle`, `normalizeText`, and `getSubmissionStatusLabel`.
- Exact SHA-256 comparison between the tracked runtime payload and the Chrome-loaded source directory.
- Browser validation of Dashboard, Manuscripts, Submissions & Review, journal portals, reviewer tools, Settings, and toolbar navigation.

## Rollback

The annotated `v3.1.0` tag preserves the previous verified source snapshot. The pre-v4 WXT/TypeScript `main` history remains reachable through Git history immediately before the v4.0.0 integration commit.
